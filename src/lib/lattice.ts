/**
 * 中式窗棂（用 SVG pattern 平铺，成本极低）
 * ---------------------------------------------------------------
 * 每个 pattern 的边长都经过选择，保证跨 tile 的线段在边界处接得上。
 */

export interface Lattice {
  id: string;
  /** 中文名，用于 aria-label 与图注 */
  name: string;
  size: number;
  /** 平铺线段（无 fill，只描边） */
  paths: string[];
  /** 线宽（相对 pattern 尺寸） */
  width: number;
}

/** 冰裂纹：中心八出，边缘接点 24 / 60 / 96 —— 相邻 tile 自然咬合 */
const ice: Lattice = {
  id: "ice",
  name: "冰裂纹",
  size: 120,
  width: 1.6,
  paths: [
    "M60 0V120",
    "M0 60H120",
    "M0 24L30 42L60 60L90 42L120 24",
    "M0 96L30 78L60 60L90 78L120 96",
    "M24 0L42 30L60 60L78 30L96 0",
    "M24 120L42 90L60 60L78 90L96 120",
  ],
};

/** 步步锦：一圈圈往里的方形踏步 */
const step: Lattice = {
  id: "step",
  name: "步步锦",
  size: 120,
  width: 1.7,
  paths: [
    "M0 0H120",
    "M0 0V120",
    "M22 22H98V98H22Z",
    "M44 44H76V76H44Z",
    "M60 22V44M60 76V98",
    "M22 60H44M76 60H98",
    "M60 0V22M60 98V120",
    "M0 60H22M98 60H120",
  ],
};

/** 万字纹：四臂勾连，横竖都接得上 */
const wan: Lattice = {
  id: "wan",
  name: "万字纹",
  size: 80,
  width: 1.7,
  paths: ["M40 0V40H80", "M40 0V40H0", "M0 40H40V80", "M80 40H40V80"],
};

/** 龟背锦：截角正方铺砌，留下的小方块自然成纹 */
const tortoise: Lattice = {
  id: "tortoise",
  name: "龟背锦",
  size: 72,
  width: 1.6,
  paths: [
    "M15 0H57L72 15V57L57 72H15L0 57V15Z",
    "M15 0H57L72 15V57L57 72H15L0 57V15Z",
  ],
};

/** 灯笼锦：菱形套菱形，像一排灯笼 */
const lantern: Lattice = {
  id: "lantern",
  name: "灯笼锦",
  size: 100,
  width: 1.6,
  paths: [
    "M50 6L94 60L50 114L6 60Z",
    "M50 26L76 60L50 94L24 60Z",
    "M50 6V0M50 114V120",
    "M6 60H0M94 60H100",
  ],
};

export const LATTICES: Record<string, Lattice> = {
  ice,
  step,
  wan,
  tortoise,
  lantern,
};

export const LATTICE_LIST: Lattice[] = [ice, step, wan, tortoise, lantern];

export function latticeById(id: string | undefined): Lattice {
  return (id && LATTICES[id]) || ice;
}
