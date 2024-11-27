import sharp from "sharp";

const PIXEL_SIZE = 50;

export const img = async ({ fileBuffer }: { fileBuffer: ArrayBuffer }) => {
  const pixelatedBuffer = await sharp(fileBuffer)
    .resize(PIXEL_SIZE, null, { kernel: sharp.kernel.nearest })
    .toBuffer();
  let { width, height, format } = await sharp(fileBuffer).metadata();
  let sharpBuffer = await sharp(pixelatedBuffer)
    .resize(width, null, { kernel: sharp.kernel.nearest })
    .toBuffer();

  if (format === "jpeg") {
    sharpBuffer = await sharp(sharpBuffer).webp().toBuffer();
    format = "webp";
  }

  return { sharpBuffer, width, height, format };
};
