"use client";

import { useMemo, useState, type TouchEvent } from "react";

export type ProductGalleryImage = {
  url: string;
  alt: string;
};

export function ProductImageCarousel({ images, fallbackLabel }: { images: ProductGalleryImage[]; fallbackLabel: string }) {
  const galleryImages = useMemo(() => images.filter((image) => Boolean(image.url)), [images]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const hasMultipleImages = galleryImages.length > 1;
  const activeImage = galleryImages[activeIndex] ?? null;

  function showPrevious() {
    if (!hasMultipleImages) return;
    setActiveIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
  }

  function showNext() {
    if (!hasMultipleImages) return;
    setActiveIndex((current) => (current + 1) % galleryImages.length);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX === null || !hasMultipleImages) return;

    const deltaX = event.changedTouches[0]?.clientX - touchStartX;
    setTouchStartX(null);
    if (Math.abs(deltaX) < 42) return;

    if (deltaX > 0) {
      showPrevious();
    } else {
      showNext();
    }
  }

  return (
    <div className="product-image-carousel">
      <div
        className="product-carousel-stage"
        onTouchEnd={handleTouchEnd}
        onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
      >
        {activeImage ? (
          <span className="part-image-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="part-image-bg" src={activeImage.url} alt="" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="part-image-main" src={activeImage.url} alt={activeImage.alt} />
          </span>
        ) : <span>{fallbackLabel}</span>}

        {hasMultipleImages ? (
          <>
            <button className="product-carousel-arrow previous" onClick={showPrevious} type="button" aria-label="Show previous product image">
              <span aria-hidden="true">‹</span>
            </button>
            <button className="product-carousel-arrow next" onClick={showNext} type="button" aria-label="Show next product image">
              <span aria-hidden="true">›</span>
            </button>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <>
          <div className="product-carousel-thumbnails" aria-label="Product image thumbnails">
            {galleryImages.map((image, index) => (
              <button
                aria-current={index === activeIndex}
                aria-label={`Show product image ${index + 1}`}
                className={index === activeIndex ? "active" : ""}
                key={`${image.url}-${index}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.alt} />
              </button>
            ))}
          </div>
          <div className="product-carousel-dots" aria-label="Product image position">
            {galleryImages.map((image, index) => (
              <button
                aria-current={index === activeIndex}
                aria-label={`Show product image ${index + 1}`}
                className={index === activeIndex ? "active" : ""}
                key={`${image.url}-dot-${index}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
