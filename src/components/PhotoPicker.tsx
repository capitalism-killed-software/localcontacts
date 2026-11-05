'use client';
import { useEffect, useRef, useState } from 'react';
import PhotoImg from './PhotoImg';
import { Bust } from './Silhouette';
import { isWholeImage, sniffImage } from '@/lib/photo';

const MAX = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Edit mode's photo square: click it to choose an image, "remove" to clear
// it. The file goes up with the form; the server checks it again.
export default function PhotoPicker({ current }: { current: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const choose = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    // Check the bytes, not the name: a renamed file is still not an image.
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!TYPES.includes(file.type) || !sniffImage(head)) {
      setError('Choose a JPEG, PNG, GIF or WebP image.');
      if (input.current) input.current.value = '';
      return;
    }
    if (file.size > MAX) {
      setError('That image is larger than 2 MB.');
      if (input.current) input.current.value = '';
      return;
    }
    const type = sniffImage(head);
    if (type && !isWholeImage(type, new Uint8Array(await file.arrayBuffer()))) {
      setError('That image is damaged or cut off.');
      if (input.current) input.current.value = '';
      return;
    }
    setPreview(URL.createObjectURL(file));
    setRemoved(false);
  };

  const remove = () => {
    if (input.current) input.current.value = '';
    setPreview(null);
    setRemoved(true);
    setError(null);
  };

  return (
    <div className="photo-picker">
      <label className={`photo photo-editing${preview ? ' has-image' : ''}`} title="Choose a photo">
        {preview ? <PhotoImg key={preview} src={preview} /> : <Bust />}
        <input
          ref={input}
          type="file"
          name="photo"
          accept={TYPES.join(',')}
          className="visually-hidden"
          aria-label="Choose a photo"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </label>
      {preview && (
        <button type="button" className="photo-remove" onClick={remove}>
          remove
        </button>
      )}
      <input type="hidden" name="remove_photo" value={removed ? '1' : ''} />
      {error && (
        <p className="photo-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
