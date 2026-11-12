export interface PublicTripImage {
  mediaId: string;
  position: number;
  url: string;
  width: number;
  height: number;
}

export interface PublicTripImageFields {
  images?: PublicTripImage[];
  coverImage?: PublicTripImage | null;
  imageCount?: number;
}

export interface SavedPublicTripGallery {
  tripId: string;
  version: number;
  images: PublicTripImage[];
  coverImage: PublicTripImage | null;
  imageCount: number;
}
