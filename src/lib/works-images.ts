/**
 * 作品实拍图
 * ---------------------------------------------------------------
 * 照片放进 src/assets/works/，在作品的 frontmatter 里只写文件名：
 *
 *   image: 六合同春-正面.jpg
 *   gallery: [六合同春-侧面.jpg, 六合同春-细节.jpg]
 *
 * 构建期用 glob 收进来交给 Astro 的 <Image>：自动出 webp、出多倍图、算尺寸，
 * 不用手动裁图。文件名写错会在构建时报错，并把目录里现有的文件名列出来。
 */

const MODULES = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/works/*.{jpg,jpeg,png,webp,avif,gif}",
  { eager: true }
);

export const WORK_IMAGE_DIR = "src/assets/works/";

/** 目录里现有的文件名，用于报错时提示 */
export const WORK_IMAGE_FILES: string[] = Object.keys(MODULES)
  .map((key) => key.split("/").pop() ?? key)
  .sort();

function pick(file: string, where: string): ImageMetadata {
  const key = Object.keys(MODULES).find((k) => k.endsWith(`/${file}`));
  const mod = key ? MODULES[key] : undefined;
  if (!mod) {
    throw new Error(
      `找不到作品图片「${file}」（来自 ${where}）。\n` +
        `· 请把图片放进 ${WORK_IMAGE_DIR}，文件名必须和 frontmatter 里写的一模一样（含大小写与扩展名）\n` +
        `· 该目录目前有：${WORK_IMAGE_FILES.length ? WORK_IMAGE_FILES.join("、") : "（空）"}`
    );
  }
  return mod.default;
}

/** 封面图：没写就返回 null，页面会退回算法生成的团花 */
export function coverImage(file: string | undefined, where: string): ImageMetadata | null {
  return file ? pick(file, where) : null;
}

/** 详情页下面的那排实拍图 */
export function galleryImages(files: string[], where: string): ImageMetadata[] {
  return files.map((f) => pick(f, where));
}
