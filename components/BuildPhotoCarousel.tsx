"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export type BuildPhoto = {
  id: string;
  url: string;
  alt_text?: string | null;
};

type BuildPhotoCarouselProps = {
  photos: BuildPhoto[];
  title?: string;
};

export function BuildPhotoCarousel({ photos, title = "Verified Tacoma build" }: BuildPhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasMultiplePhotos = photos.length > 1;
  const currentPhoto = photos[currentIndex];

  function showPrevious() {
    setCurrentIndex((index) => (index === 0 ? photos.length - 1 : index - 1));
  }

  function showNext() {
    setCurrentIndex((index) => (index === photos.length - 1 ? 0 : index + 1));
  }

  return (
    <div className="build-carousel card">
      <div className="build-photo-frame">
        {currentPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentPhoto.url} alt={currentPhoto.alt_text ?? title} />
        ) : (
          <div className="build-carousel-placeholder">
            <span>No photos yet</span>
          </div>
        )}

        {hasMultiplePhotos ? (
          <>
            <button className="carousel-button previous" type="button" onClick={showPrevious} aria-label="Previous photo">
              <ChevronLeft size={22} />
            </button>
            <button className="carousel-button next" type="button" onClick={showNext} aria-label="Next photo">
              <ChevronRight size={22} />
            </button>
            <span className="carousel-count">{currentIndex + 1} / {photos.length}</span>
            <div className="carousel-dots" aria-label={`Photo ${currentIndex + 1} of ${photos.length}`}>
              {photos.map((photo, index) => (
                <button
                  aria-label={`Show photo ${index + 1}`}
                  className={index === currentIndex ? "active" : ""}
                  key={photo.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
