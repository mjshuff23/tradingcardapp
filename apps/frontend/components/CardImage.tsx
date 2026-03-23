import { useState } from 'react';

type CardImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function CardImage({ src, alt, className }: CardImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`card-image card-image--fallback${className ? ` ${className}` : ''}`}>
        <span>No image</span>
      </div>
    );
  }

  return (
    <img
      className={`card-image${className ? ` ${className}` : ''}`}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
