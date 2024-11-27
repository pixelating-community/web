import sharp from "sharp";

export const img = async ({
  fileBuffer,
  pixelSize,
}: {
  fileBuffer: ArrayBuffer;
  pixelSize: number;
}) => {
  const pixelatedBuffer = await sharp(fileBuffer)
    .resize(Math.abs(pixelSize), null, { kernel: sharp.kernel.nearest })
    .toBuffer();
  const { width, height } = await sharp(fileBuffer).metadata();
  let { format } = await sharp(fileBuffer).metadata();
  let sharpBuffer = await sharp(pixelatedBuffer)
    .resize(width, null, { kernel: sharp.kernel.nearest })
    .toBuffer();

  if (format === "jpeg") {
    sharpBuffer = await sharp(sharpBuffer).webp().toBuffer();
    format = "webp";
  }

  return { sharpBuffer, width, height, format };
};
