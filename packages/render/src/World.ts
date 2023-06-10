import { generateId, generateChecksum } from '@allmaps/id/browser'
import {
  parseAnnotation,
  validateMap,
  type Map as Georef
} from '@allmaps/annotation'
import { GCPTransformer } from '@allmaps/transform'

import RTree from './RTree.js'

import { fromLonLat, getPolygonBBox } from './shared/geo.js'
import { combineBBoxes } from './shared/bbox.js'
import { WarpedMapEvent, WarpedMapEventType } from './shared/events.js'

import { fetchImageInfo } from '@allmaps/stdlib'
import { Image as IIIFImage } from '@allmaps/iiif-parser'

import type { Position, BBox, WarpedMap } from './shared/types.js'

export default class World extends EventTarget {
  warpedMapsById: Map<string, WarpedMap> = new Map()
  zIndices: Map<string, number> = new Map()

  rtree?: RTree
  imageInfoCache?: Cache

  constructor(rtree?: RTree, imageInfoCache?: Cache) {
    super()
    this.rtree = rtree
    this.imageInfoCache = imageInfoCache
  }

  private async getMapId(map: Georef) {
    const mapId = map.id || (await generateChecksum(map))
    return mapId
  }

  private async addMapInternal(map: Georef) {
    try {
      const mapId = await this.getMapId(map)

      const gcps = map.gcps
      const pixelMask = map.pixelMask

      const sphericalMercatorGcps = gcps.map(({ world, image }) => ({
        world: fromLonLat(world),
        image
      }))

      // TODO: to make sure only tiles for visible parts of the map are requested
      // (and not for parts hidden behind maps on top of it)
      // Subtract geoMasks of maps that have been added before the current map:
      // Map A (topmost): show completely
      // Map B: B - A
      // Map C: C - B - A
      // Map D: D - C - B - A
      //
      // Possible libraries:
      //  - https://github.com/w8r/martinez
      //  - https://github.com/mfogel/polygon-clipping

      // TODO: make the transformation type tunabel by user
      const transformer = new GCPTransformer(
        sphericalMercatorGcps,
        'polynomial'
      )

      const geoMask = transformer.toGeoJSONPolygon(pixelMask)

      const fullPixelMask: Position[] = [
        [0, 0],
        [map.image.width, 0],
        [map.image.width, map.image.height],
        [0, map.image.height]
      ]
      const fullGeoMask = transformer.toGeoJSONPolygon(fullPixelMask)

      // TODO: only load info.json when its needed
      const imageUri = map.image.uri
      const imageInfoJson = await fetchImageInfo(imageUri, {
        cache: this.imageInfoCache
      })
      const parsedImage = IIIFImage.parse(imageInfoJson)
      const imageId = await generateId(imageUri)

      const warpedMap: WarpedMap = {
        imageId,
        mapId,
        visible: true,
        parsedImage,
        pixelMask,
        transformer,
        geoMask,
        geoMaskBBox: getPolygonBBox(geoMask),
        fullGeoMask,
        fullGeoMaskBBox: getPolygonBBox(fullGeoMask)
      }

      this.warpedMapsById.set(mapId, warpedMap)

      const zIndex = this.warpedMapsById.size - 1
      this.zIndices.set(mapId, zIndex)

      if (this.rtree) {
        this.rtree.addItem(mapId, geoMask)
      }

      this.dispatchEvent(
        new WarpedMapEvent(WarpedMapEventType.WARPEDMAPADDED, mapId)
      )

      return mapId
    } catch (err) {
      if (err instanceof Error) {
        return err
      } else {
        throw err
      }
    }
  }

  private async removeMapInternal(map: Georef) {
    try {
      const mapId = await this.getMapId(map)

      const warpedMap = this.warpedMapsById.get(mapId)

      if (warpedMap) {
        this.warpedMapsById.delete(mapId)
        this.zIndices.delete(mapId)

        if (this.rtree) {
          this.rtree.removeItem(mapId)
        }

        this.dispatchEvent(
          new WarpedMapEvent(WarpedMapEventType.WARPEDMAPREMOVED, mapId)
        )
      } else {
        throw new Error(`No map found with ID ${mapId}`)
      }

      return mapId
    } catch (err) {
      if (err instanceof Error) {
        return err
      } else {
        throw err
      }
    }
  }

  async addMap(map: unknown): Promise<string | Error> {
    const validatedMapOrMaps = validateMap(map)
    const validatedMap = Array.isArray(validatedMapOrMaps)
      ? validatedMapOrMaps[0]
      : validatedMapOrMaps
    return this.addMapInternal(validatedMap)
  }

  async removeMap(map: unknown): Promise<string | Error> {
    const validatedMapOrMaps = validateMap(map)
    const validatedMap = Array.isArray(validatedMapOrMaps)
      ? validatedMapOrMaps[0]
      : validatedMapOrMaps
    return this.removeMapInternal(validatedMap)
  }

  async addGeoreferenceAnnotation(
    annotation: unknown
  ): Promise<(string | Error)[]> {
    const results: (string | Error)[] = []

    const maps = parseAnnotation(annotation)

    const settledResults = await Promise.allSettled(
      maps.map((map) => this.addMapInternal(map))
    )

    // TODO: make sure reason contains Error
    for (const settledResult of settledResults) {
      if (settledResult.status === 'fulfilled') {
        results.push(settledResult.value)
      } else {
        results.push(settledResult.reason)
      }
    }

    this.dispatchEvent(
      new WarpedMapEvent(WarpedMapEventType.GEOREFERENCEANNOTATIONADDED)
    )
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.ZINDICESCHANGES))

    return results
  }

  async removeGeoreferenceAnnotation(
    annotation: unknown
  ): Promise<(string | Error)[]> {
    const results: (string | Error)[] = []

    const maps = parseAnnotation(annotation)

    for (const map of maps) {
      const mapIdOrError = await this.removeMapInternal(map)
      results.push(mapIdOrError)
    }

    this.dispatchEvent(
      new WarpedMapEvent(WarpedMapEventType.GEOREFERENCEANNOTATIONREMOVED)
    )

    this.removeZIndexHoles()
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.ZINDICESCHANGES))

    return results
  }

  private removeZIndexHoles() {
    const sortedZIndices = [...this.zIndices.entries()].sort(
      (entryA, entryB) => entryA[1] - entryB[1]
    )

    let zIndex = 0

    for (const entry of sortedZIndices) {
      const mapId = entry[0]
      this.zIndices.set(mapId, zIndex)
      zIndex++
    }
  }

  getZIndex(mapId: string) {
    return this.zIndices.get(mapId)
  }

  bringToFront(mapIds: Iterable<string>) {
    let newZIndex = this.warpedMapsById.size

    for (const mapId of mapIds) {
      if (this.zIndices.has(mapId)) {
        this.zIndices.set(mapId, newZIndex)
        newZIndex++
      }
    }

    this.removeZIndexHoles()
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.ZINDICESCHANGES))
  }

  sendToBack(mapIds: string[]) {
    let newZIndex = -mapIds.length

    for (const mapId of mapIds) {
      if (this.zIndices.has(mapId)) {
        this.zIndices.set(mapId, newZIndex)
        newZIndex++
      }
    }

    this.removeZIndexHoles()
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.ZINDICESCHANGES))
  }

  bringForward(mapIds: Iterable<string>) {
    for (const [mapId, zIndex] of this.zIndices.entries()) {
      this.zIndices.set(mapId, zIndex * 2)
    }

    for (const mapId of mapIds) {
      const zIndex = this.zIndices.get(mapId)
      if (zIndex !== undefined) {
        this.zIndices.set(mapId, zIndex + 3)
      }
    }

    this.removeZIndexHoles()
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.ZINDICESCHANGES))
  }

  sendBackward(mapIds: Iterable<string>) {
    for (const [mapId, zIndex] of this.zIndices.entries()) {
      this.zIndices.set(mapId, zIndex * 2)
    }

    for (const mapId of mapIds) {
      const zIndex = this.zIndices.get(mapId)
      if (zIndex !== undefined) {
        this.zIndices.set(mapId, zIndex - 3)
      }
    }

    this.removeZIndexHoles()
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.ZINDICESCHANGES))
  }

  setPixelMask(mapId: string, pixelMask: Position[]) {
    const warpedMap = this.warpedMapsById.get(mapId)
    if (warpedMap) {
      const geoMask = warpedMap.transformer.toGeoJSONPolygon(pixelMask)
      warpedMap.geoMask = geoMask
      warpedMap.geoMaskBBox = getPolygonBBox(geoMask)

      if (this.rtree) {
        this.rtree.removeItem(mapId)
        this.rtree.addItem(mapId, geoMask)
      }

      this.dispatchEvent(
        new WarpedMapEvent(WarpedMapEventType.PIXELMASKUPDATED, mapId)
      )
    }
  }

  showMaps(mapIds: Iterable<string>) {
    for (const mapId of mapIds) {
      const warpedMap = this.warpedMapsById.get(mapId)
      if (warpedMap) {
        warpedMap.visible = true
      }
    }
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.VISIBILITYCHANGED))
  }

  hideMaps(mapIds: Iterable<string>) {
    for (const mapId of mapIds) {
      const warpedMap = this.warpedMapsById.get(mapId)
      if (warpedMap) {
        warpedMap.visible = false
      }
    }
    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.VISIBILITYCHANGED))
  }

  getPossibleVisibleWarpedMapIds(geoBBox: BBox) {
    if (this.rtree) {
      return this.rtree.searchBBox(geoBBox)
    } else {
      return this.warpedMapsById.keys()
    }
  }

  getMaps() {
    return this.warpedMapsById.values()
  }

  getMap(mapId: string) {
    return this.warpedMapsById.get(mapId)
  }

  clear() {
    this.warpedMapsById = new Map()
    this.zIndices = new Map()

    this.rtree?.clear()

    this.dispatchEvent(new WarpedMapEvent(WarpedMapEventType.CLEARED))
  }

  getBBox(): BBox | undefined {
    let bbox

    for (const warpedMap of this.warpedMapsById.values()) {
      if (warpedMap.visible) {
        if (!bbox) {
          bbox = warpedMap.geoMaskBBox
        } else {
          bbox = combineBBoxes(bbox, warpedMap.geoMaskBBox)
        }
      }
    }

    return bbox
  }

  setImageInfoCache(cache: Cache) {
    this.imageInfoCache = cache
  }
}
