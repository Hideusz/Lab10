"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type ImageModalProps = {
  productId: number;
  productName: string;
  image: string;
};

export function ImageModal({
  productId,
  productName,
  image,
}: ImageModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusFrame = useRef<number | null>(null);

  useEffect(() => {
    if (restoreFocusFrame.current !== null) {
      window.cancelAnimationFrame(restoreFocusFrame.current);
      restoreFocusFrame.current = null;
    }

    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open) dialog.close();

      // Po cofnięciu nawigacji wywołującej modal przywróć fokus do linku obrazu.
      restoreFocusFrame.current = window.requestAnimationFrame(() => {
        const opener = document.getElementById(
          `product-image-trigger-${productId}`,
        );
        if (opener instanceof HTMLElement) {
          opener.focus({ preventScroll: true });
        }
        restoreFocusFrame.current = null;
      });
    };
  }, [productId]);

  const closeModal = () => router.back();

  return (
    <dialog
      ref={dialogRef}
      className="image-modal"
      aria-labelledby="image-modal-title"
      onCancel={(event) => {
        // Escape zamyka trasę modalną, a nie tylko element <dialog>.
        event.preventDefault();
        closeModal();
      }}
      onClick={(event) => {
        // Kliknięcie w przyciemnione tło zamyka okno; kliknięcie obrazu nie.
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div className="image-modal__content">
        <div className="image-modal__header">
          <h2 id="image-modal-title">{productName}</h2>
          <button
            ref={closeButtonRef}
            className="image-modal__close"
            type="button"
            onClick={closeModal}
            aria-label="Zamknij powiększone zdjęcie"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="image-modal__image-wrap">
          <Image
            src={image}
            alt={`Powiększone zdjęcie produktu: ${productName}`}
            width={1200}
            height={1200}
            sizes="(max-width: 700px) 94vw, 1000px"
            className="image-modal__image"
          />
        </div>
        <p className="image-modal__hint">
          Naciśnij Escape lub użyj przycisku zamknięcia, aby wrócić.
        </p>
      </div>
    </dialog>
  );
}
