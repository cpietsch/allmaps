import { writable, derived, get } from 'svelte/store'

import { generateChecksum } from '@allmaps/id/browser'
import { parseAnnotation, generateAnnotation } from '@allmaps/annotation'
import { fetchImageInfo } from '@allmaps/stdlib'
import { Image } from '@allmaps/iiif-parser'

import { getDefaultRenderOptions } from '$lib/shared/defaults.js'
import { getBackgroundColor } from '$lib/shared/remove-background.js'
import { fromHue } from '$lib/shared/color.js'
import {
  imageInfoCache,
  mapWarpedMapSource,
  addMap,
  removeMap
} from '$lib/shared/stores/openlayers.js'

import type { ViewerMap } from '$lib/shared/types.js'

import type { Position } from '@allmaps/render'

type SourceMaps = Map<string, ViewerMap>

export const mapsById = writable<SourceMaps>(new Map())

export const mapIndex = writable<number[]>([])

export async function addAnnotation(sourceId: string, json: any) {
  let startIndex = get(mapCount)

  const maps = parseAnnotation(json)

  let mapIds: string[] = []

  if (maps.length) {
    let newViewerMaps: ViewerMap[] = []

    for (let map of maps) {
      const mapId = map.id || (await generateChecksum(map))

      const viewerMap: ViewerMap = {
        sourceId,
        mapId,
        index: startIndex++,
        map,
        annotation: generateAnnotation(map),
        opacity: 1,
        state: {
          visible: true,
          selected: false,
          highlighted: false
        },
        // TODO: detect background color of map?
        renderOptions: getDefaultRenderOptions(false, false)
      }

      viewerMap.renderOptions.colorize.color = fromHue((viewerMap.index * 60) % 360)

      newViewerMaps.push(viewerMap)
      mapIds.push(mapId)
      await addMap(viewerMap)

      const imageUri = map.image.uri
      const imageInfo = await fetchImageInfo(imageUri, {
        cache: imageInfoCache
      })
      const parsedImage = Image.parse(imageInfo)

      // Process image once, also when the same image is used
      // in multiple georeferenced maps
      getBackgroundColor(map, parsedImage)
        .then((color) => setRemoveBackgroundColor(mapId, color))
        .catch((err) => {
          console.error(
            `Couldn't detect background color for map ${mapId}`,
            err
          )
        })
    }

    mapsById.update(($mapsById) => {
      for (let viewerMap of newViewerMaps) {
        $mapsById.set(viewerMap.mapId, viewerMap)
      }

      return $mapsById
    })
  }

  return mapIds
}

export function resetCustomPixelMask(mapId: string) {
  mapsById.update(($mapsById) => {
    const viewerMap = $mapsById.get(mapId)

    if (viewerMap) {
      viewerMap.state.customPixelMask = undefined
      mapWarpedMapSource.setPixelMask(mapId, viewerMap.map.pixelMask)
    }

    return $mapsById
  })
}

export function setCustomPixelMask(mapId: string, customPixelMask: Position[]) {
  mapsById.update(($mapsById) => {
    const viewerMap = $mapsById.get(mapId)

    if (viewerMap) {
      viewerMap.state.customPixelMask = customPixelMask
      mapWarpedMapSource.setPixelMask(mapId, customPixelMask)
    }

    return $mapsById
  })
}

export function setRemoveBackgroundColor(
  mapId: string,
  removeBackgroundColor: string
) {
  mapsById.update(($mapsById) => {
    const viewerMap = $mapsById.get(mapId)

    if (viewerMap) {
      viewerMap.renderOptions.removeBackground.color = removeBackgroundColor
    }

    return $mapsById
  })
}

export async function removeAnnotation(sourceId: string) {
  mapsById.update(($mapsById) => {
    for (let [id, map] of $mapsById.entries()) {
      if (map.sourceId === sourceId) {
        $mapsById.delete(id)
        removeMap(map)
      }
    }

    return $mapsById
  })
}

export function resetMaps() {
  mapsById.set(new Map())
}

export const mapIds = derived(mapsById, ($mapsById) => $mapsById.keys())

export const maps = derived(mapsById, ($mapsById) => [...$mapsById.values()])

export const mapCount = derived(mapsById, ($mapsById) => $mapsById.size)

export const visibleMaps = derived(mapsById, ($mapsById) =>
  [...$mapsById.values()].filter((map) => map.state.visible)
)
