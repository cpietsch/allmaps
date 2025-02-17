import { Image } from '@allmaps/iiif-parser'

import type { GcpTransformer } from '@allmaps/transform'
import type { TileZoomLevel } from '@allmaps/iiif-parser'

import { computeBbox, bboxToPolygon } from '@allmaps/stdlib'

import type { Size, BBox, Position, Tile, Line, Ring } from './types.js'
import type { Polygon } from '@allmaps/types'

type PositionByX = { [key: number]: Position }

function distanceFromPoint(tile: Tile, point: Position) {
  const center = tileCenter(tile)

  const dx = center[0] - point[0]
  const dy = center[1] - point[1]

  return Math.sqrt(dx ** 2 + dy ** 2)
}

export function imageCoordinatesToTileCoordinates(
  tile: Tile,
  imageCoordinates: Position,
  clip = true
): Position | undefined {
  const tileXMin = tile.column * tile.zoomLevel.originalWidth
  const tileYMin = tile.row * tile.zoomLevel.originalHeight

  const tileX = (imageCoordinates[0] - tileXMin) / tile.zoomLevel.scaleFactor
  const tileY = (imageCoordinates[1] - tileYMin) / tile.zoomLevel.scaleFactor

  if (
    !clip ||
    (imageCoordinates[0] >= tileXMin &&
      imageCoordinates[0] <= tileXMin + tile.zoomLevel.originalWidth &&
      imageCoordinates[1] >= tileYMin &&
      imageCoordinates[1] <= tileYMin + tile.zoomLevel.originalHeight &&
      imageCoordinates[0] <= tile.imageSize[0] &&
      imageCoordinates[1] <= tile.imageSize[1])
  ) {
    return [tileX, tileY]
  }
}

export function tileBBox(tile: Tile): BBox {
  const tileXMin = tile.column * tile.zoomLevel.originalWidth
  const tileYMin = tile.row * tile.zoomLevel.originalHeight

  const tileXMax = Math.min(
    tileXMin + tile.zoomLevel.originalWidth,
    tile.imageSize[0]
  )
  const tileYMax = Math.min(
    tileYMin + tile.zoomLevel.originalHeight,
    tile.imageSize[1]
  )

  return [tileXMin, tileYMin, tileXMax, tileYMax]
}

export function tileCenter(tile: Tile): Position {
  const bbox = tileBBox(tile)

  return [(bbox[2] - bbox[0]) / 2 + bbox[0], (bbox[3] - bbox[1]) / 2 + bbox[1]]
}

// From:
//  https://github.com/vHawk/tiles-intersect
// See also:
//  https://www.redblobgames.com/grids/line-drawing.html
function tilesIntersect([a, b]: Line): Position[] {
  let x = Math.floor(a[0])
  let y = Math.floor(a[1])
  const endX = Math.floor(b[0])
  const endY = Math.floor(b[1])

  const points: Position[] = [[x, y]]

  if (x === endX && y === endY) {
    return points
  }

  const stepX = Math.sign(b[0] - a[0])
  const stepY = Math.sign(b[1] - a[1])

  const toX = Math.abs(a[0] - x - Math.max(0, stepX))
  const toY = Math.abs(a[1] - y - Math.max(0, stepY))

  const vX = Math.abs(a[0] - b[0])
  const vY = Math.abs(a[1] - b[1])

  let tMaxX = toX / vX
  let tMaxY = toY / vY

  const tDeltaX = 1 / vX
  const tDeltaY = 1 / vY

  while (!(x === endX && y === endY)) {
    if (tMaxX < tMaxY) {
      tMaxX = tMaxX + tDeltaX
      x = x + stepX
    } else {
      tMaxY = tMaxY + tDeltaY
      y = y + stepY
    }

    points.push([x, y])
  }

  return points
}

function getBestZoomLevelForMapScale(
  image: Image,
  mapTileScale: number
): TileZoomLevel {
  const tileZoomLevels = image.tileZoomLevels

  let smallestScaleDiff = Number.POSITIVE_INFINITY
  let bestZoomLevel = tileZoomLevels[tileZoomLevels.length - 1]

  for (const zoomLevel of tileZoomLevels) {
    const scaleFactor = zoomLevel.scaleFactor
    const scaleDiff = Math.abs(scaleFactor - mapTileScale)

    // scaleFactors:
    // 1.......2.......4.......8.......16
    //
    // Example mapTileScale = 3
    // 1.......2..|....4.......8.......16
    //
    // scaleFactor 2:
    //   scaleDiff = 1
    //   scaleFactor * 1.25 = 2.5 => 2.5 >= 3 === false
    //
    // scaleFactor 4:
    //   scaleDiff = 1
    //   scaleFactor * 1.25 = 5 => 5 >= 3 === true
    //
    // Pick scaleFactor 4!

    // TODO: read 1.25 from config
    // TODO: maybe use a smaller value when the scaleFactor is low and a higher value when the scaleFactor is high?
    // TODO: use lgoarithmic scale?
    if (scaleDiff < smallestScaleDiff && scaleFactor * 1.25 >= mapTileScale) {
      smallestScaleDiff = scaleDiff
      bestZoomLevel = zoomLevel
    }
  }

  return bestZoomLevel
}

function scaleToTiles(zoomLevel: TileZoomLevel, points: Ring): Ring {
  return points.map((point) => [
    point[0] / zoomLevel.originalWidth,
    point[1] / zoomLevel.originalHeight
  ])
}

function findNeededIiifTilesByX(tilePixelExtent: Ring) {
  const tiles: PositionByX = {}
  for (let i = 0; i < tilePixelExtent.length; i++) {
    const line: Line = [
      tilePixelExtent[i],
      tilePixelExtent[(i + 1) % tilePixelExtent.length]
    ]
    const lineTiles = tilesIntersect(line)

    lineTiles.forEach(([x, y]) => {
      if (!tiles[x]) {
        tiles[x] = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
      }

      if (y < tiles[x][0]) {
        tiles[x][0] = y
      }

      if (y > tiles[x][1]) {
        tiles[x][1] = y
      }
    })
  }

  return tiles
}

function iiifTilesByXToArray(
  zoomLevel: TileZoomLevel,
  imageSize: Size,
  iiifTilesByX: PositionByX
): Tile[] {
  const neededIiifTiles: Tile[] = []
  for (const xKey in iiifTilesByX) {
    const x = parseInt(xKey)

    if (x < 0 || x >= zoomLevel.columns) {
      break
    }

    const fromY = Math.max(iiifTilesByX[x][0], 0)
    const toY = Math.min(iiifTilesByX[x][1], zoomLevel.rows - 1)

    for (let y = fromY; y <= toY; y++) {
      neededIiifTiles.push({
        column: x,
        row: y,
        zoomLevel,
        imageSize
      })
    }
  }

  return neededIiifTiles
}

export function getResourcePolygon(transformer: GcpTransformer, geoBBox: BBox) {
  // geoBBox is a BBox of the extent viewport in geospatial coordinates (in the projection that was given)
  // geoBBoxResourcePolygon is a polygon of this BBox, transformed to resource coordinates.
  // Due to transformerOptions this in not necessarilly a 4-point ring, but can have more points.

  const geoBBoxPolygon = bboxToPolygon(geoBBox)
  const geoBBoxResourcePolygon = transformer.transformBackward(geoBBoxPolygon, {
    maxOffsetRatio: 0.00001,
    maxDepth: 2
  }) as Polygon

  return geoBBoxResourcePolygon
}

export function getBestZoomLevel(
  image: Image,
  viewportSize: Size,
  resourcePolygon: Polygon
): TileZoomLevel {
  const resourceBBox = computeBbox(resourcePolygon)

  const resourceBBoxWidth = resourceBBox[2] - resourceBBox[0]
  const resourceBBoxHeight = resourceBBox[3] - resourceBBox[1]

  const mapScaleX = resourceBBoxWidth / viewportSize[0]
  const mapScaleY = resourceBBoxHeight / viewportSize[1]
  const mapScale = Math.min(mapScaleX, mapScaleY)

  return getBestZoomLevelForMapScale(image, mapScale)
}

export function computeIiifTilesForPolygonAndZoomLevel(
  image: Image,
  resourcePolygon: Polygon,
  zoomLevel: TileZoomLevel
): Tile[] {
  const tilePixelExtent = scaleToTiles(zoomLevel, resourcePolygon[0])

  const iiifTilesByX = findNeededIiifTilesByX(tilePixelExtent)
  const iiifTiles = iiifTilesByXToArray(
    zoomLevel,
    [image.width, image.height],
    iiifTilesByX
  )

  // sort tiles to load tiles in order of their distance to center
  // TODO: move to new SortedFetch class
  const resourceBBox = computeBbox(resourcePolygon)
  const resourceCenter: Position = [
    (resourceBBox[0] + resourceBBox[2]) / 2,
    (resourceBBox[1] + resourceBBox[3]) / 2
  ]

  iiifTiles.sort(
    (tileA, tileB) =>
      distanceFromPoint(tileA, resourceCenter) -
      distanceFromPoint(tileB, resourceCenter)
  )

  return iiifTiles
}
