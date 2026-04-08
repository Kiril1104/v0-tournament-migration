"use client";

/**
 * Декоративні логотипи у верхніх кутах вікна.
 * pointer-events-none — не перехоплюють кліки; обмежена ширина — не зустрічаються по центру на вузькому екрані.
 */
export function CornerBrandLogos() {
  const imgClass =
    "h-12 w-auto max-w-[min(38vw,11rem)] object-contain opacity-95 drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)] sm:h-16 sm:max-w-[13rem] md:h-[4.25rem]";

  return (
    <>
      <div
        className="pointer-events-none fixed left-2 top-2 z-[8] sm:left-4 sm:top-3"
        aria-hidden
      >
        <img
          src="/futurestars-cups-logo.png"
          alt=""
          width={520}
          height={520}
          className={`${imgClass} object-left`}
          decoding="async"
        />
      </div>
      <div
        className="pointer-events-none fixed right-2 top-2 z-[8] sm:right-4 sm:top-3"
        aria-hidden
      >
        <img
          src="/futurestars-cups-logo.png"
          alt=""
          width={520}
          height={520}
          className={`${imgClass} object-right`}
          decoding="async"
        />
      </div>
    </>
  );
}
