import * as THREE from 'three';

/** Accumulates triangles with world-space UVs and vertex colors, then builds one BufferGeometry. */
export class Geo {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = [];
  get empty() { return this.pos.length === 0; }
  private v(x: number, y: number, z: number, n: number[], u: number, w: number, c: number[]) {
    this.pos.push(x, y, z); this.nor.push(n[0], n[1], n[2]); this.uv.push(u, w); this.col.push(c[0], c[1], c[2]);
  }
  /** Quad a,b,c,d counter-clockwise seen from the front. */
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], uvs: number[][], col: number[]) {
    this.v(a[0], a[1], a[2], n, uvs[0][0], uvs[0][1], col); this.v(b[0], b[1], b[2], n, uvs[1][0], uvs[1][1], col); this.v(c[0], c[1], c[2], n, uvs[2][0], uvs[2][1], col);
    this.v(a[0], a[1], a[2], n, uvs[0][0], uvs[0][1], col); this.v(c[0], c[1], c[2], n, uvs[2][0], uvs[2][1], col); this.v(d[0], d[1], d[2], n, uvs[3][0], uvs[3][1], col);
  }
  tri(a: number[], b: number[], c: number[], n: number[], uvs: number[][], col: number[]) {
    this.v(a[0], a[1], a[2], n, uvs[0][0], uvs[0][1], col); this.v(b[0], b[1], b[2], n, uvs[1][0], uvs[1][1], col); this.v(c[0], c[1], c[2], n, uvs[2][0], uvs[2][1], col);
  }
  /** Axis-aligned box. su/sv: meters per texture repeat on the sides. top: optional separate Geo for the top face (roof). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: number[], su = 4, sv = 4, top: Geo | null = this, topScale = 8, sides = true, yo = 0) {
    if (sides) {
      const U = (a: number) => a / su, V = (y: number) => (y - yo) / sv;
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[U(x0), V(y0)], [U(x1), V(y0)], [U(x1), V(y1)], [U(x0), V(y1)]], col);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[U(-x1), V(y0)], [U(-x0), V(y0)], [U(-x0), V(y1)], [U(-x1), V(y1)]], col);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[U(-z1), V(y0)], [U(-z0), V(y0)], [U(-z0), V(y1)], [U(-z1), V(y1)]], col);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[U(z0), V(y0)], [U(z1), V(y0)], [U(z1), V(y1)], [U(z0), V(y1)]], col);
    }
    if (top) { const T = (a: number) => a / topScale; top.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[T(x0), T(-z1)], [T(x1), T(-z1)], [T(x1), T(-z0)], [T(x0), T(-z0)]], col); }
  }
  /** Flat horizontal quad. */
  flat(x0: number, z0: number, x1: number, z1: number, y: number, col: number[], scale = 4) {
    const T = (a: number) => a / scale;
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [[T(x0), T(-z1)], [T(x1), T(-z1)], [T(x1), T(-z0)], [T(x0), T(-z0)]], col);
  }
  /** Gable roof over a box footprint, ridge along the longer side. */
  gable(x0: number, z0: number, x1: number, z1: number, y: number, rise: number, col: number[], ends: Geo, endCol: number[]) {
    const o = 0.5, X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o, alongX = x1 - x0 >= z1 - z0;
    if (alongX) {
      const zm = (z0 + z1) / 2, k = rise / ((Z1 - Z0) / 2), n1 = norm([0, 1, -k]), n2 = norm([0, 1, k]);
      this.quad([X0, y, Z0], [X1, y, Z0], [X1, y + rise, zm], [X0, y + rise, zm], n1, [[X0 / 3, 0], [X1 / 3, 0], [X1 / 3, 2], [X0 / 3, 2]], col);
      this.quad([X1, y, Z1], [X0, y, Z1], [X0, y + rise, zm], [X1, y + rise, zm], n2, [[X1 / 3, 0], [X0 / 3, 0], [X0 / 3, 2], [X1 / 3, 2]], col);
      ends.tri([x0, y, z1], [x0, y, z0], [x0, y + rise, zm], [-1, 0, 0], [[0, 0], [1, 0], [0.5, 0.4]], endCol);
      ends.tri([x1, y, z0], [x1, y, z1], [x1, y + rise, zm], [1, 0, 0], [[0, 0], [1, 0], [0.5, 0.4]], endCol);
    } else {
      const xm = (x0 + x1) / 2, k = rise / ((X1 - X0) / 2), n1 = norm([-k, 1, 0]), n2 = norm([k, 1, 0]);
      this.quad([X0, y, Z1], [X0, y, Z0], [xm, y + rise, Z0], [xm, y + rise, Z1], n1, [[Z1 / 3, 0], [Z0 / 3, 0], [Z0 / 3, 2], [Z1 / 3, 2]], col);
      this.quad([X1, y, Z0], [X1, y, Z1], [xm, y + rise, Z1], [xm, y + rise, Z0], n2, [[Z0 / 3, 0], [Z1 / 3, 0], [Z1 / 3, 2], [Z0 / 3, 2]], col);
      ends.tri([x0, y, z0], [x1, y, z0], [xm, y + rise, z0], [0, 0, -1], [[0, 0], [1, 0], [0.5, 0.4]], endCol);
      ends.tri([x1, y, z1], [x0, y, z1], [xm, y + rise, z1], [0, 0, 1], [[0, 0], [1, 0], [0.5, 0.4]], endCol);
    }
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
export function norm(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
