import Projective from '../shared/projective.js'

import type { GCPTransformerInterface, Position, GCP } from '../shared/types.js'

export default class ProjectiveGCPTransformer
  implements GCPTransformerInterface
{
  gcps: GCP[]

  gcpGeoCoords: Position[]
  gcpResourceCoords: Position[]

  toGeoProjective?: Projective
  toResourceProjective?: Projective

  constructor(gcps: GCP[]) {
    this.gcps = gcps

    this.gcpGeoCoords = gcps.map((gcp) => gcp.geo)
    this.gcpResourceCoords = gcps.map((gcp) => gcp.resource)
  }

  createToGeoProjective(): Projective {
    return new Projective(this.gcpResourceCoords, this.gcpGeoCoords)
  }

  createToResourceProjective(): Projective {
    return new Projective(this.gcpGeoCoords, this.gcpResourceCoords)
  }

  toGeo(point: Position): Position {
    if (!this.toGeoProjective) {
      this.toGeoProjective = this.createToGeoProjective()
    }

    return this.toGeoProjective.interpolant(point)
  }

  toResource(point: Position): Position {
    if (!this.toResourceProjective) {
      this.toResourceProjective = this.createToResourceProjective()
    }

    return this.toResourceProjective.interpolant(point)
  }
}
