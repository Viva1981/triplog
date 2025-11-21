"use client";

import { motion, PanInfo } from "framer-motion";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { TripFile } from "@/lib/trip/types";

type Props = {
  files: TripFile[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

function getLargeImage(file: TripFile): string {
  if (file.thumbnail_link) {
    let url = file.thumbnail_link;
    if (url.includes("googleusercontent.com")) {
      url = url.replace(/=s\d+(-c)?/, "=s2000");
    }
    return url;
  }
  return file.preview_link || "";
}

export default function PhotoLightbox({ files, index, onClose, onPrev, onNext }: Props) {
  const file = files[index];

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 80;

    if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
      if (info.offset.x > threshold) onPrev();
      else if (info.offset.x < -threshold) onNext();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm">
      
      {/* Háttér – katt → Close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Tartalom */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        
        {/* Desktop bezárás */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 hidden rounded-full bg-black/60 px-3 py-1 text-sm text-white hover:bg-black md:block"
        >
          Bezárás
        </button>

        {/* Bal oldali nyíl desktopon */}
        <button
          onClick={onPrev}
          className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 transform items-center justify-center rounded-full bg-black/60 text-xl text-white hover:bg-black md:flex"
        >
          ◀
        </button>

        {/* Swipe area + pinch-zoom wrapper */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          drag="x"
          dragElastic={0.15}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
        >
          <TransformWrapper
            pinch={{ disabled: false }}
            doubleClick={{ disabled: false }}
            wheel={{ disabled: true }}
            minScale={1}
            maxScale={4}
            centerOnInit
          >
            <TransformComponent
              wrapperClass="w-full h-full flex items-center justify-center"
            >
              <img
                src={getLargeImage(file)}
                alt={file.name}
                className="
                  absolute top-1/2 left-1/2 
                  max-h-[100vh] w-auto 
                  -translate-x-1/2 -translate-y-1/2 
                  transform object-contain select-none
                "
                referrerPolicy="no-referrer"
              />
            </TransformComponent>
          </TransformWrapper>
        </motion.div>

        {/* Jobb oldali nyíl desktopon */}
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 transform items-center justify-center rounded-full bg-black/60 text-xl text-white hover:bg-black md:flex"
        >
          ▶
        </button>

        {/* Desktop footer info */}
        <div className="absolute bottom-4 left-0 right-0 hidden items-center justify-between px-6 text-sm text-white/90 md:flex">
          <div className="truncate">{file.name}</div>
          <div>
            {index + 1} / {files.length}
          </div>
        </div>
      </div>
    </div>
  );
}
