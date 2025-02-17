// TODO: consider implementing these functions in this module instead of using dependencies
import getWorldMidpoint from '@turf/midpoint'
import getWorldDistance from '@turf/distance'

import {
  getMidPosition,
  getDistance,
  conformLineString,
  conformRing
} from '@allmaps/stdlib'

import type {
  TransformGcp,
  Segment,
  TransformOptions,
  GcpTransformerInterface,
  PartialTransformOptions
} from './types.js'

import type { Position, LineString, Ring, Polygon } from '@allmaps/types'

function mergeDefaultOptions(
  options?: PartialTransformOptions
): TransformOptions {
  const mergedOptions = {
    close: false,
    maxOffsetRatio: 0,
    maxDepth: 0,
    destinationIsGeographic: false,
    sourceIsGeographic: false
  }

  if (options && options.maxDepth !== undefined) {
    mergedOptions.maxDepth = options.maxDepth
  }

  if (options && options.maxOffsetRatio !== undefined) {
    mergedOptions.maxOffsetRatio = options.maxOffsetRatio
  }

  if (options && options.destinationIsGeographic !== undefined) {
    mergedOptions.destinationIsGeographic = options.destinationIsGeographic
  }

  if (options && options.sourceIsGeographic !== undefined) {
    mergedOptions.sourceIsGeographic = options.sourceIsGeographic
  }

  return mergedOptions
}

export function transformLineStringForwardToLineString(
  transformer: GcpTransformerInterface,
  lineString: LineString,
  options?: PartialTransformOptions
): LineString {
  const mergedOptions = mergeDefaultOptions(options)

  lineString = conformLineString(lineString)

  const points = lineString.map((position) => ({
    source: position,
    destination: transformer.transformForward(position)
  }))

  const segments = pointsToSegments(points, false)
  const extendedSegments =
    recursivelyAddMidpointsWithDestinationMidPositionFromTransform(
      transformer,
      segments,
      mergedOptions
    )

  return segmentsToPoints(extendedSegments, true).map(
    (point) => point.destination
  )
}

export function transformLineStringBackwardToLineString(
  transformer: GcpTransformerInterface,
  lineString: LineString,
  options?: PartialTransformOptions
): LineString {
  const mergedOptions = mergeDefaultOptions(options)

  lineString = conformLineString(lineString)

  const points: TransformGcp[] = lineString.map((position) => ({
    source: transformer.transformBackward(position),
    destination: position
  }))

  const segments = pointsToSegments(points, false)
  const extendendSegements =
    recursivelyAddMidpointsWithSourceMidPositionFromTransform(
      transformer,
      segments,
      mergedOptions
    )

  return segmentsToPoints(extendendSegements, true).map((point) => point.source)
}

export function transformRingForwardToRing(
  transformer: GcpTransformerInterface,
  ring: Ring,
  options?: PartialTransformOptions
): Ring {
  const mergedOptions = mergeDefaultOptions(options)

  ring = conformRing(ring)

  const points = ring.map((position) => ({
    source: position,
    destination: transformer.transformForward(position)
  }))

  const segments = pointsToSegments(points, true)
  const extendedSegments =
    recursivelyAddMidpointsWithDestinationMidPositionFromTransform(
      transformer,
      segments,
      mergedOptions
    )

  return segmentsToPoints(extendedSegments, false).map(
    (point) => point.destination
  )
}

export function transformRingBackwardToRing(
  transformer: GcpTransformerInterface,
  ring: Ring,
  options?: PartialTransformOptions
): Ring {
  const mergedOptions = mergeDefaultOptions(options)

  ring = conformRing(ring)

  const points: TransformGcp[] = ring.map((position) => ({
    source: transformer.transformBackward(position),
    destination: position
  }))

  const segments = pointsToSegments(points, true)
  const extendendSegements =
    recursivelyAddMidpointsWithSourceMidPositionFromTransform(
      transformer,
      segments,
      mergedOptions
    )

  return segmentsToPoints(extendendSegements, false).map(
    (point) => point.source
  )
}

export function transformPolygonForwardToPolygon(
  transformer: GcpTransformerInterface,
  polygon: Polygon,
  options?: PartialTransformOptions
): Polygon {
  return polygon.map((ring) => {
    return transformRingForwardToRing(transformer, ring, options)
  })
}

export function transformPolygonBackwardToPolygon(
  transformer: GcpTransformerInterface,
  polygon: Polygon,
  options?: PartialTransformOptions
): Polygon {
  return polygon.map((ring) => {
    return transformRingBackwardToRing(transformer, ring, options)
  })
}

function pointsToSegments(points: TransformGcp[], close = false): Segment[] {
  const segmentCount = points.length - (close ? 0 : 1)

  const segments: Segment[] = []
  for (let index = 0; index < segmentCount; index++) {
    segments.push({
      from: points[index],
      to: points[(index + 1) % points.length]
    })
  }

  return segments
}

function segmentsToPoints(segments: Segment[], close = false): TransformGcp[] {
  const points = segments.map((segment) => segment.from)
  if (close) {
    points.push(segments[segments.length - 1].to)
  }
  return points
}

function recursivelyAddMidpointsWithDestinationMidPositionFromTransform(
  transformer: GcpTransformerInterface,
  segments: Segment[],
  options: TransformOptions
) {
  if (options.maxDepth <= 0 || options.maxOffsetRatio <= 0) {
    return segments
  }

  return segments
    .map((segment) =>
      addMidpointWithDestinationMidPositionFromTransform(
        transformer,
        segment,
        options,
        0
      )
    )
    .flat(1)
}

function recursivelyAddMidpointsWithSourceMidPositionFromTransform(
  transformer: GcpTransformerInterface,
  segments: Segment[],
  options: TransformOptions
) {
  if (options.maxDepth <= 0 || options.maxOffsetRatio <= 0) {
    return segments
  }

  return segments
    .map((segment) =>
      addMidpointWithSourceMidPositionFromTransform(
        transformer,
        segment,
        options,
        0
      )
    )
    .flat(1)
}

function addMidpointWithDestinationMidPositionFromTransform(
  transformer: GcpTransformerInterface,
  segment: Segment,
  options: TransformOptions,
  depth: number
): Segment | Segment[] {
  const sourceMidPositionFunction = options.sourceIsGeographic
    ? (position1: Position, position2: Position) =>
        getWorldMidpoint(position1, position2).geometry.coordinates as Position
    : getMidPosition
  const sourceMidPosition = sourceMidPositionFunction(
    segment.from.source,
    segment.to.source
  )

  const destinationMidPositionFunction = options.destinationIsGeographic
    ? (position1: Position, position2: Position) =>
        getWorldMidpoint(position1, position2).geometry.coordinates as Position
    : getMidPosition
  const destinationMidPosition = destinationMidPositionFunction(
    segment.from.destination,
    segment.to.destination
  )
  const destinationMidPositionFromTransform =
    transformer.transformForward(sourceMidPosition)

  const destinationDistanceFunction = options.destinationIsGeographic
    ? getWorldDistance
    : getDistance
  const segmentDestinationDistance = destinationDistanceFunction(
    segment.from.destination,
    segment.to.destination
  )
  const destinationMidPositionsDistance = destinationDistanceFunction(
    destinationMidPosition,
    destinationMidPositionFromTransform
  )

  if (
    depth < options.maxDepth &&
    (options.maxOffsetRatio
      ? destinationMidPositionsDistance / segmentDestinationDistance >
        options.maxOffsetRatio
      : false) &&
    segmentDestinationDistance > 0
  ) {
    const newSegmentMidpoint: TransformGcp = {
      source: sourceMidPosition,
      destination: destinationMidPositionFromTransform
    }

    return [
      addMidpointWithDestinationMidPositionFromTransform(
        transformer,
        { from: segment.from, to: newSegmentMidpoint },
        options,
        depth + 1
      ),
      addMidpointWithDestinationMidPositionFromTransform(
        transformer,
        { from: newSegmentMidpoint, to: segment.to },
        options,
        depth + 1
      )
    ].flat(1)
  } else {
    return segment
  }
}

function addMidpointWithSourceMidPositionFromTransform(
  transformer: GcpTransformerInterface,
  segment: Segment,
  options: TransformOptions,
  depth: number
): Segment | Segment[] {
  const destinationMidPositionFunction = options.destinationIsGeographic
    ? (position1: Position, position2: Position) =>
        getWorldMidpoint(position1, position2).geometry.coordinates as Position
    : getMidPosition
  const destinationMidPosition = destinationMidPositionFunction(
    segment.from.destination,
    segment.to.destination
  )

  const sourceMidPositionFunction = options.sourceIsGeographic
    ? (position1: Position, position2: Position) =>
        getWorldMidpoint(position1, position2).geometry.coordinates as Position
    : getMidPosition
  const sourceMidPosition = sourceMidPositionFunction(
    segment.from.source,
    segment.to.source
  )
  const sourceMidPositionFromTransform = transformer.transformBackward(
    destinationMidPosition as Position
  )

  const sourceDistanceFunction = options.sourceIsGeographic
    ? getWorldDistance
    : getDistance
  const segmentSourceDistance = sourceDistanceFunction(
    segment.from.source,
    segment.to.source
  )
  const sourceMidPositionsDistance = sourceDistanceFunction(
    sourceMidPosition,
    sourceMidPositionFromTransform
  )

  if (
    depth < options.maxDepth &&
    (options.maxOffsetRatio
      ? sourceMidPositionsDistance / segmentSourceDistance >
        options.maxOffsetRatio
      : false) &&
    segmentSourceDistance > 0
  ) {
    const newSegmentMidpoint: TransformGcp = {
      source: sourceMidPositionFromTransform,
      destination: destinationMidPosition
    }

    return [
      addMidpointWithSourceMidPositionFromTransform(
        transformer,
        { from: segment.from, to: newSegmentMidpoint },
        options,
        depth + 1
      ),
      addMidpointWithSourceMidPositionFromTransform(
        transformer,
        { from: newSegmentMidpoint, to: segment.to },
        options,
        depth + 1
      )
    ].flat(1)
  } else {
    return segment
  }
}
