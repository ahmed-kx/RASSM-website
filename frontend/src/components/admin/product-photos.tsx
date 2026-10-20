"use client";

import { MAX_PHOTOS_PER_COLOR, PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_TYPES } from "@rassm/shared";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  GripIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { uploadProductImage } from "@/lib/data/admin";

interface Pending {
  key: number;
  name: string;
  error?: string;
}

const MAX_MB = PRODUCT_IMAGE_MAX_BYTES / 1024 / 1024;

/** Checked in the browser too, so a wrong file fails at once (the API checks again). */
function fileError(file: File): string | null {
  if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Format non accepté : photo JPG, PNG ou WebP uniquement.";
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return `La photo dépasse ${MAX_MB} Mo. Choisissez une photo plus légère.`;
  }
  return null;
}

/**
 * Photos of one color: upload several, reorder (drag on a computer, arrows on a phone),
 * choose the main photo (the first), delete. The first photo of the first color is the
 * product's main photo on the website.
 */
export function ProductPhotos({
  colorName,
  images,
  onAdd,
  onMove,
  onRemove,
  error,
}: {
  colorName: string;
  images: readonly string[];
  onAdd: (url: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (url: string) => void;
  error?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const nextKey = useRef(0);
  const room = MAX_PHOTOS_PER_COLOR - images.length - pending.filter((p) => !p.error).length;

  const upload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const key = (nextKey.current += 1);
      const problem = fileError(file);
      setPending((list) => [...list, { key, name: file.name, ...(problem && { error: problem }) }]);
      if (problem) continue;
      try {
        const image = await uploadProductImage(file);
        onAdd(image.url);
        setPending((list) => list.filter((item) => item.key !== key));
      } catch (caught) {
        const message =
          caught instanceof ApiError ? caught.message : "L'envoi de la photo a échoué.";
        setPending((list) =>
          list.map((item) => (item.key === key ? { ...item, error: message } : item)),
        );
      }
    }
    if (input.current) input.current.value = "";
  };

  const arrow =
    "grid size-8 place-items-center rounded-sm bg-paper/90 text-ink shadow-sm disabled:opacity-30";

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((url, index) => (
          <li
            key={url}
            draggable
            onDragStart={() => setDragFrom(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragFrom !== null && dragFrom !== index) onMove(dragFrom, index);
              setDragFrom(null);
            }}
            onDragEnd={() => setDragFrom(null)}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-sm border bg-cream",
              index === 0 ? "border-ink" : "border-line",
              dragFrom === index && "opacity-50",
            )}
          >
            <Image
              src={url}
              alt={`${colorName}, photo ${index + 1}`}
              fill
              sizes="(min-width: 1024px) 140px, 30vw"
              className="object-contain"
            />
            {index === 0 ? (
              <span className="absolute top-1.5 left-1.5 rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-paper uppercase">
                Principale
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onMove(index, 0)}
                className="absolute top-1.5 left-1.5 rounded-sm bg-paper/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase shadow-sm hover:bg-paper"
              >
                Principale ?
              </button>
            )}
            <GripIcon
              aria-hidden="true"
              width={16}
              height={16}
              className="absolute top-2 right-1.5 hidden cursor-grab text-ash lg:block"
            />
            <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label={`Déplacer la photo ${index + 1} vers la gauche`}
                  disabled={index === 0}
                  onClick={() => onMove(index, index - 1)}
                  className={arrow}
                >
                  <ChevronLeftIcon width={14} height={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Déplacer la photo ${index + 1} vers la droite`}
                  disabled={index === images.length - 1}
                  onClick={() => onMove(index, index + 1)}
                  className={arrow}
                >
                  <ChevronRightIcon width={14} height={14} />
                </button>
              </span>
              <button
                type="button"
                aria-label={`Supprimer la photo ${index + 1}`}
                onClick={() => onRemove(url)}
                className={cn(arrow, "text-error")}
              >
                <TrashIcon width={14} height={14} />
              </button>
            </div>
          </li>
        ))}
        {pending.map((item) => (
          <li
            key={item.key}
            className={cn(
              "relative grid aspect-square place-items-center rounded-sm border p-2 text-center text-[11px]",
              item.error
                ? "border-error/60 bg-error/5 text-error"
                : "border-line bg-paper text-stone",
            )}
          >
            {item.error ? (
              <>
                <span className="line-clamp-4">{item.error}</span>
                <button
                  type="button"
                  aria-label="Fermer ce message"
                  onClick={() => setPending((list) => list.filter((p) => p.key !== item.key))}
                  className="absolute top-1 right-1 grid size-7 place-items-center"
                >
                  <CloseIcon width={12} height={12} />
                </button>
              </>
            ) : (
              <span className="motion-safe:animate-pulse">Envoi…</span>
            )}
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              htmlFor={inputId}
              className="grid aspect-square cursor-pointer place-items-center rounded-sm border border-dashed border-ink/40 bg-paper text-center text-xs text-ash hover:border-ink hover:text-ink"
            >
              <span className="grid justify-items-center gap-1.5 px-2">
                <UploadIcon width={20} height={20} />
                Ajouter des photos
              </span>
            </label>
            <input
              ref={input}
              id={inputId}
              type="file"
              multiple
              accept={PRODUCT_IMAGE_TYPES.join(",")}
              onChange={(event) => void upload(event.target.files)}
              className="sr-only"
            />
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-stone">
        JPG, PNG ou WebP, {MAX_MB} Mo maximum, {MAX_PHOTOS_PER_COLOR} photos par couleur. La
        première est la photo principale.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
