import { decode as decodeJpeg } from 'jpeg-js'
import { encode as encodePng } from 'upng-js'

import { Image } from '@allmaps/iiif-parser'
import { GcpTransformer } from '@allmaps/transform'
import {
  getResourcePolygon,
  getBestZoomLevel,
  computeIiifTilesForPolygonAndZoomLevel
} from '@allmaps/render'

import { cachedFetch } from './fetch.js'
import {
  xyzTileToGeoBBox,
  pointInPolygon,
  tileToLongitude,
  tileToLatitude
} from './geo.js'

import type { Coord, XYZTile, Cache, Tile, Options } from './types.js'
import type { Map } from '@allmaps/annotation'

const TILE_SIZE = 256
const CHANNELS = 4

export async function createWarpedTileResponse(
  maps: Map[],
  { x, y, z }: XYZTile,
  options: Options,
  cache: Cache
): Promise<Response> {
  // Create resulting warped tile
  const warpedTile = new Uint8Array(TILE_SIZE * TILE_SIZE * CHANNELS)

  if (!(x >= 0 && y >= 0 && z >= 0)) {
    throw new Error('x, y and z must be positive integers')
  }

  for (const map of maps) {
    // Set resourceMask
    let resourceMask
    if (map.resourceMask) {
      resourceMask = map.resourceMask
    } else {
      // TODO: create mask from full image
      throw new Error('Map does not have resourceMask')
    }

    const imageInfoResponse = await cachedFetch(
      cache,
      `${map.resource.id}/info.json`
    )

    const imageInfo = await imageInfoResponse.json()
    const parsedImage: Image = Image.parse(imageInfo)

    // Compute xyz tile extent
    const geoBBox = xyzTileToGeoBBox({ x, y, z })

    // Create transformer
    const transformer = new GcpTransformer(
      map.gcps,
      options['transformation.type'] || map.transformation?.type
    )

    // Compute necessary IIIF tiles
    const geoBBoxResourcePolygon = getResourcePolygon(transformer, geoBBox)

    const zoomLevel = getBestZoomLevel(
      parsedImage,
      [TILE_SIZE, TILE_SIZE],
      geoBBoxResourcePolygon
    )

    const iiifTiles = computeIiifTilesForPolygonAndZoomLevel(
      parsedImage,
      geoBBoxResourcePolygon,
      zoomLevel
    )

    // Get IIIF tile urls
    const iiifTileUrls = iiifTiles.map((tile: Tile) => {
      const { region, size } = parsedImage.getIiifTile(
        tile.zoomLevel,
        tile.column,
        tile.row
      )
      return parsedImage.getImageUrl({ region, size })
    })

    // Fetch IIIF tiles
    // TODO: find a way to do max. 6 requests at the same time,
    // instead of one by one with this loop
    // https://developers.cloudflare.com/workers/platform/limits/
    const iiifTileResponses = []
    for (const url of iiifTileUrls) {
      const response = await cachedFetch(cache, url)
      iiifTileResponses.push(response)
    }

    // Create images from fetch response
    const iiifTileImages: ArrayBuffer[] = await Promise.all(
      iiifTileResponses.map((response) => response.arrayBuffer())
    )

    // Decode images to buffer
    // TODO: Rename
    const decodedJpegs = iiifTileImages.map((buffer) =>
      decodeJpeg(buffer, { useTArray: true })
    )

    // Step through all warped tile pixels and set their color
    // TODO: if there's nothing to render, send HTTP code? Or empty PNG?
    for (
      let warpedTilePixelX = 0;
      warpedTilePixelX < TILE_SIZE;
      warpedTilePixelX++
    ) {
      for (
        let warpedTilePixelY = 0;
        warpedTilePixelY < TILE_SIZE;
        warpedTilePixelY++
      ) {
        // Go from warped tile pixel location to corresponding pixel location (with decimals) on resource tiles, in two steps
        // 1) Detemine lonlat of warped tile pixel location
        const warpedTilePixelGeo: Coord = [
          tileToLongitude({ x: x + warpedTilePixelX / TILE_SIZE, z: z }),
          tileToLatitude({ y: y + warpedTilePixelY / TILE_SIZE, z: z })
        ]
        // 2) Determine corresponding pixel location (with decimals) on resource using transformer
        const [pixelX, pixelY] =
          transformer.transformToResource(warpedTilePixelGeo)

        // Check if pixel inside resource mask
        // TODO: improve efficiency
        // TODO: fix strange repeating error,
        //    remove pointInPolygon check and fix first
        const inside = pointInPolygon([pixelX, pixelY], resourceMask)
        if (!inside) {
          continue
        }

        // Determine tile index of resource tile on which this pixel location (with decimals) is
        let tileIndex: number | undefined
        let tile: Tile | undefined
        let tileXMin: number | undefined
        let tileYMin: number | undefined
        let foundTile = false
        for (tileIndex = 0; tileIndex < iiifTiles.length; tileIndex++) {
          tile = iiifTiles[tileIndex]
          tileXMin = tile.column * tile.zoomLevel.originalWidth
          tileYMin = tile.row * tile.zoomLevel.originalHeight
          if (
            pixelX >= tileXMin &&
            pixelX <= tileXMin + tile.zoomLevel.originalWidth &&
            pixelY >= tileYMin &&
            pixelY <= tileYMin + tile.zoomLevel.originalHeight
          ) {
            foundTile = true
            break
          }
        }

        // If tile is found, set color of this warped tile pixel
        if (
          foundTile &&
          tile &&
          tileXMin !== undefined &&
          tileYMin !== undefined
        ) {
          // Decode this resource tile
          const decodedJpeg = decodedJpegs[tileIndex]

          if (decodedJpeg) {
            // Get resource tile size
            const resourceTileSize = tile.zoomLevel.width

            // Schematic drawing of resource tile and sub-pixel location of (pixelTileX, pixelTileY)
            //
            // PixelTile: +
            // Surrounding pixels: *
            //
            //   Y
            //   ^
            // 2 *---------* 3
            //   |         |
            //   |         |
            //   |   +     |
            // 0 *---------* 1 > X
            //
            // Determine (sub-)pixel coordinates on resource tile
            const pixelTileX = (pixelX - tileXMin) / tile.zoomLevel.scaleFactor
            const pixelTileY = (pixelY - tileYMin) / tile.zoomLevel.scaleFactor
            // Determine coordinates of four surrounding pixels 0, 1, 2, 3 on the resource tile
            const pixelTileXFloor = Math.max(Math.floor(pixelTileX), 0)
            const pixelTileXCeil = Math.min(
              Math.ceil(pixelTileX),
              resourceTileSize - 1
            )
            const pixelTileYFloor = Math.max(Math.floor(pixelTileY), 0)
            const pixelTileYCeil = Math.min(
              Math.ceil(pixelTileY),
              resourceTileSize - 1
            )
            // Determine bufferIndices of four surrounding pixels 0, 1, 2, 3
            const bufferIndices = [
              pixelToIndex(
                pixelTileXFloor,
                pixelTileYFloor,
                decodedJpeg.width,
                CHANNELS
              ),
              pixelToIndex(
                pixelTileXCeil,
                pixelTileYFloor,
                decodedJpeg.width,
                CHANNELS
              ),
              pixelToIndex(
                pixelTileXFloor,
                pixelTileYCeil,
                decodedJpeg.width,
                CHANNELS
              ),
              pixelToIndex(
                pixelTileXCeil,
                pixelTileYCeil,
                decodedJpeg.width,
                CHANNELS
              )
            ]
            // Determine remaining (sub-)pixel decimals on resource tile
            const pixelTileXDecimals = pixelTileX - Math.floor(pixelTileX)
            const pixelTileYDecimals = pixelTileY - Math.floor(pixelTileY)

            // Define index in result buffer
            const warpedBufferIndex =
              (warpedTilePixelY * TILE_SIZE + warpedTilePixelX) * CHANNELS
            // For each color, compute and set the color of the warpedTile pixel
            // by interpolating the color of the four surrounding pixels on the resource tile
            // and set it on the warpedBufferIndex
            for (let color = 0; color < CHANNELS; color++) {
              warpedTile[warpedBufferIndex + color] =
                decodedJpeg.data[bufferIndices[0] + color] *
                  (1 - pixelTileXDecimals) *
                  (1 - pixelTileYDecimals) +
                decodedJpeg.data[bufferIndices[1] + color] *
                  pixelTileXDecimals *
                  (1 - pixelTileYDecimals) +
                decodedJpeg.data[bufferIndices[2] + color] *
                  (1 - pixelTileXDecimals) *
                  pixelTileYDecimals +
                decodedJpeg.data[bufferIndices[3] + color] *
                  pixelTileXDecimals *
                  pixelTileYDecimals
            }
          }
        }
      }
    }
  }

  const png = encodePng([warpedTile.buffer], TILE_SIZE, TILE_SIZE, 256)
  const tileResponse = new Response(png, {
    status: 200,
    headers: { 'content-type': 'image/png' }
  })

  return tileResponse
}

function pixelToIndex(
  pixelX: number,
  pixelY: number,
  width: number,
  channels: number
): number {
  return (pixelY * width + pixelX) * channels
}
