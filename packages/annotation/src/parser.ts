import { z } from 'zod'

import {
  AnnotationAllVersionsSchema,
  AnnotationPageAllVersionsSchema,
  FeaturePropertiesAllVersionsSchema,
  ImageServiceSchema,
  Annotation0Schema,
  Annotation1Schema,
  AnnotationPage0Schema,
  AnnotationPage1Schema
} from './schemas/annotation.js'

import {
  Map2Schema,
  Maps2Schema,
  GCPSchema,
  ResourceSchema,
  PartOfSchema,
  ResourceMaskSchema
} from './schemas/map.js'

import {
  isAnnotationPageBeforeParse,
  isAnnotation0BeforeParse
} from './before-parse.js'
import { isAnnotation1 } from './guards.js'

type AnnotationAllVersions = z.infer<typeof AnnotationAllVersionsSchema>
type AnnotationPageAllVersions = z.infer<typeof AnnotationPageAllVersionsSchema>
type Map2 = z.infer<typeof Map2Schema>
type Maps2 = z.infer<typeof Maps2Schema>
type Resource = z.infer<typeof ResourceSchema>
type ResourceMask = z.infer<typeof ResourceMaskSchema>
type GCP = z.infer<typeof GCPSchema>
type PartOf = z.infer<typeof PartOfSchema>
type FeatureProperties = z.infer<typeof FeaturePropertiesAllVersionsSchema>
type ImageService = z.infer<typeof ImageServiceSchema>

function parseResource(annotation: AnnotationAllVersions): Resource {
  return {
    id: parseImageId(annotation),
    ...parseImageDimensions(annotation),
    type: parseImageService(annotation),
    partOf: parsePartOf(annotation)
  }
}

function parseImageId(annotation: AnnotationAllVersions): string {
  if (isAnnotation1(annotation)) {
    return annotation.target.source['@id']
  } else {
    return annotation.target.service[0]['@id']
  }
}

function parseImageService(annotation: AnnotationAllVersions): ImageService {
  if ('service' in annotation.target) {
    return annotation.target.service[0].type
  } else {
    return annotation.target.source.type
  }
}

function parsePartOf(annotation: AnnotationAllVersions): PartOf[] | undefined {
  if (isAnnotation1(annotation)) {
    return annotation.target.source.partOf
  }
}

function parseResourceCoords(properties: FeatureProperties) {
  if ('pixelCoords' in properties) {
    return properties.pixelCoords
  } else {
    return properties.resourceCoords
  }
}

function parseGcps(annotation: AnnotationAllVersions): GCP[] {
  return annotation.body.features.map((gcpFeature) => ({
    resource: parseResourceCoords(gcpFeature.properties),
    geo: gcpFeature.geometry.coordinates
  }))
}

function parseImageDimensions(annotation: AnnotationAllVersions): {
  width: number
  height: number
} {
  if (isAnnotation1(annotation)) {
    return {
      width: annotation.target.source.width,
      height: annotation.target.source.height
    }
  }

  const selector = annotation.target.selector

  const svg = selector.value

  const widthResult = /width="(?<width>\d+)"/.exec(svg)
  const heightResult = /height="(?<height>\d+)"/.exec(svg)

  const width = widthResult?.groups?.width
  const height = heightResult?.groups?.height

  if (!width || !height) {
    throw new Error('Could not parse image dimensions')
  }

  return {
    width: parseInt(width),
    height: parseInt(height)
  }
}

function parseResourceMask(annotation: AnnotationAllVersions): ResourceMask {
  const selector = annotation.target.selector
  const svg = selector.value

  const result = /points="(?<points>.+)"/.exec(svg)
  const groups = result?.groups

  if (groups && groups.points) {
    const pointStrings = groups.points.trim().split(/\s+/)

    // Resource masks are not round-trip: they don't repeat the first point at the end of the list of points.
    // According to their spec, SVG polygons are not supposed to be round-trip either.
    // Here we deal with inputs that are round-trip by removing the last point
    if (pointStrings[0] === pointStrings[pointStrings.length - 1]) {
      pointStrings.splice(-1)
    }

    if (pointStrings.length >= 3) {
      return pointStrings.map((point: string) => {
        const numberStrings = point.split(',')

        if (numberStrings.length === 2) {
          return [parseFloat(numberStrings[0]), parseFloat(numberStrings[1])]
        } else {
          throw new Error('Could not parse resource mask')
        }
      })
    } else {
      throw new Error('Could not parse resource mask')
    }
  } else {
    throw new Error('Could not parse resource mask')
  }
}

function getMap(annotation: AnnotationAllVersions): Map2 {
  return {
    '@context': 'https://schemas.allmaps.org/map/2/context.json',
    type: 'GeoreferencedMap',
    id: annotation.id,
    resource: parseResource(annotation),
    gcps: parseGcps(annotation),
    resourceMask: parseResourceMask(annotation),
    transformation: annotation.body.transformation
  }
}

/**
 * Parses a {@link Annotation Georeference Annotation} or an {@link AnnotationPage AnnotationPage}
 * containing multiple Georeference Annotations and returns an array of {@link Map maps}.
 * @param {Annotation | AnnotationPage} annotation - Georeference Annotation or AnnotationPage containing multiple Georeference Annotations
 * @returns {Map[]} Array of maps
 * @example
 * import fs from 'fs'
 * import { parseAnnotation } from '@allmaps/annotation'
 *
 * const annotation = JSON.parse(fs.readFileSync('./examples/annotation.example.json'))
 * const maps = parseAnnotation(annotation)
 */
export function parseAnnotation(annotation: unknown): Maps2 {
  if (isAnnotationPageBeforeParse(annotation)) {
    // Seperate .parse for different versions for better Zod errors
    let parsedAnnotationPage: AnnotationPageAllVersions
    if (
      'items' in annotation &&
      Array.isArray(annotation.items) &&
      isAnnotation0BeforeParse(annotation.items[0])
    ) {
      parsedAnnotationPage = AnnotationPage0Schema.parse(annotation)
    } else {
      parsedAnnotationPage = AnnotationPage1Schema.parse(annotation)
    }

    return parsedAnnotationPage.items.map((parsedAnnotation) =>
      getMap(parsedAnnotation)
    )
  } else {
    // Seperate .parse for different versions for better Zod errors
    let parsedAnnotation: AnnotationAllVersions
    if (isAnnotation0BeforeParse(annotation)) {
      parsedAnnotation = Annotation0Schema.parse(annotation)
    } else {
      parsedAnnotation = Annotation1Schema.parse(annotation)
    }

    return [getMap(parsedAnnotation)]
  }
}
