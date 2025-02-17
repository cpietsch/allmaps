import {
  isLineString,
  isPolygon,
  isPosition,
  conformRing,
  conformPolygon
} from './geometry.js'

/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Position,
  LineString,
  Ring,
  Polygon,
  GeojsonPoint,
  GeojsonLineString,
  GeojsonPolygon,
  GeojsonGeometry,
  GeojsonFeature,
  GeojsonFeatureCollection,
  SvgGeometry
} from '@allmaps/types'

// Assert

export function isGeojsonPoint(input: any): input is GeojsonPoint {
  return (
    typeof input === 'object' &&
    input !== null &&
    input.type === 'Point' &&
    isPosition(input.coordinates)
  )
}

export function isGeojsonLineString(input: any): input is GeojsonLineString {
  return (
    typeof input === 'object' &&
    input !== null &&
    input.type === 'LineString' &&
    isLineString(input.coordinates)
  )
}

export function isGeojsonPolygon(input: any): input is GeojsonPolygon {
  return (
    typeof input === 'object' &&
    input !== null &&
    input.type === 'Polygon' &&
    Array.isArray(input.coordinates) &&
    isPolygon(input.coordinates)
  )
}

export function isGeojsonGeometry(obj: unknown): obj is GeojsonGeometry {
  const isObject = typeof obj === 'object' && obj !== null
  const hasStringType =
    isObject && 'type' in obj && typeof obj.type === 'string'
  const isValidType =
    hasStringType &&
    (obj.type === 'Point' ||
      obj.type === 'LineString' ||
      obj.type === 'Polygon')
  const hasCoordinatesArray =
    isObject && 'coordinates' in obj && Array.isArray(obj.coordinates)

  return isValidType && hasCoordinatesArray
}

// Convert to Geometry

export function convertGeojsonPointToPosition(
  geometry: GeojsonPoint
): Position {
  return geometry.coordinates
}

export function convertGeojsonLineStringToLineString(
  geometry: GeojsonLineString
): LineString {
  return geometry.coordinates
}

export function convertGeojsonPolygonToRing(
  geometry: GeojsonPolygon,
  close = false
): Ring {
  let outerRing = geometry.coordinates[0]
  outerRing = conformRing(outerRing)
  return close ? [...outerRing, outerRing[0]] : outerRing
}

export function convertGeojsonPolygonToPolygon(
  geometry: GeojsonPolygon,
  close = false
): Polygon {
  let polygon = geometry.coordinates
  polygon = conformPolygon(polygon)
  return close ? polygon.map((ring) => [...ring, ring[0]]) : polygon
}

// Convert to SVG

export function convertGeojsonToSvg(geometry: GeojsonGeometry): SvgGeometry {
  if (geometry.type === 'Point') {
    return {
      type: 'circle',
      coordinates: geometry.coordinates
    }
  } else if (geometry.type === 'LineString') {
    return {
      type: 'polyline',
      coordinates: geometry.coordinates
    }
  } else if (geometry.type === 'Polygon') {
    return {
      type: 'polygon',
      coordinates: geometry.coordinates[0]
    }
  } else {
    throw new Error(`Unsupported GeoJSON geometry`)
  }
}

// Wrap

export function geometryToFeature(
  geometry: GeojsonGeometry,
  properties?: unknown
): GeojsonFeature {
  return {
    type: 'Feature',
    properties: properties ? properties : {},
    geometry: geometry
  }
}

export function featuresToFeatureCollection(
  features: GeojsonFeature | GeojsonFeature[]
): GeojsonFeatureCollection {
  if (!Array.isArray(features)) {
    features = [features]
  }
  return {
    type: 'FeatureCollection',
    features: features
  }
}

export function geometriesToFeatureCollection(
  geometries: GeojsonGeometry[],
  properties?: unknown[]
) {
  return {
    type: 'FeatureCollection',
    features: geometries.map((geometry, i) =>
      properties
        ? geometryToFeature(geometry, properties[i])
        : geometryToFeature(geometry)
    )
  }
}
