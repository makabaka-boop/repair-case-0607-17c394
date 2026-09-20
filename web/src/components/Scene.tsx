import type { PrecheckResponse } from "../types";

interface Props {
  result: PrecheckResponse;
}

const W = 880;
const H = 560;
const PAD = 40;

interface View {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  k: number; // mm -> px
}

function computeView(result: PrecheckResponse): View {
  const xs: number[] = [];
  const ys: number[] = [];
  result.nodes.forEach((p) => {
    xs.push(p.x);
    ys.push(p.y);
  });
  result.circles.forEach((c) => {
    xs.push(c.center.x - c.radius, c.center.x + c.radius);
    ys.push(c.center.y - c.radius, c.center.y + c.radius);
  });

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
    minX = 0;
    maxX = 1;
    minY = 0;
    maxY = 1;
  }
  // 防止零宽/零高
  if (maxX - minX < 1) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (maxY - minY < 1) {
    minY -= 0.5;
    maxY += 0.5;
  }

  const k = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY));
  // 按几何内容居中
  return { minX, minY, maxX, maxY, k };
}

function Marker({
  cx,
  cy,
  r,
  fill,
  stroke,
  label,
  testid,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  label?: string;
  testid?: string;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        data-testid={testid}
      />
      {label !== undefined && (
        <text x={cx + r + 4} y={cy - r - 4} className="svg-label">
          {label}
        </text>
      )}
    </g>
  );
}

export function Scene({ result }: Props) {
  const view = computeView(result);

  // mm 坐标 -> svg 像素（y 翻转），保持纵横比一致
  const sx = (x: number) => PAD + (x - view.minX) * view.k;
  const sy = (y: number) => H - PAD - (y - view.minY) * view.k;
  const sr = (r: number) => r * view.k;

  const pathD = result.nodes
    .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`)
    .join(" ");

  // Keep the diagram aligned with the deepest-intrusion detail.
  const first =
    result.collisions.length > 0
      ? result.collisions.reduce((closest, collision) =>
          collision.distance < closest.distance ? collision : closest,
        )
      : null;
  const firstKey = first
    ? `${first.segment_index}-${first.circle_index}`
    : null;

  const cablePx = Math.max(2, sr(result.cable_radius));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="scene"
      role="img"
      aria-label="电缆路径与禁入圈判定图"
      data-testid="scene"
    >
      <rect x={0} y={0} width={W} height={H} rx={12} className="scene-bg" />

      {/* 禁入圈：先扩张安全圈（虚线），再实体孔圈 */}
      {result.circles.map((c, i) => (
        <g key={`circle-${i}`}>
          <circle
            cx={sx(c.center.x)}
            cy={sy(c.center.y)}
            r={sr(c.expanded_radius)}
            className="expanded-circle"
            data-testid={`expanded-circle-${i}`}
          />
          <circle
            cx={sx(c.center.x)}
            cy={sy(c.center.y)}
            r={sr(c.radius)}
            className="forbidden-circle"
            data-testid={`forbidden-circle-${i}`}
          />
          <text x={sx(c.center.x)} y={sy(c.center.y) - sr(c.radius) - 6} className="svg-label circle-label">
            孔 #{i}
          </text>
        </g>
      ))}

      {/* 电缆折线路径（线宽体现电缆半径） */}
      <path d={pathD} className="cable-path" strokeWidth={cablePx} fill="none" />
      <path d={pathD} className="cable-axis" strokeWidth={1} fill="none" />

      {/* 路径节点 */}
      {result.nodes.map((p, i) => (
        <Marker
          key={`node-${i}`}
          cx={sx(p.x)}
          cy={sy(p.y)}
          r={4}
          fill="#7dd3fc"
          stroke="#0369a1"
          label={`N${i}`}
          testid={`node-${i}`}
        />
      ))}

      {/* 判定位置（最近点）：首个突出，其余列出 */}
      {result.collisions.map((c) => {
        const key = `${c.segment_index}-${c.circle_index}`;
        const isFirst = key === firstKey;
        const cx = sx(c.nearest.x);
        const cy = sy(c.nearest.y);
        const size = isFirst ? 9 : 5;
        return (
          <g key={`hit-${key}`} data-testid={`collision-${key}`}>
            {/* 圆心 -> 判定位置 的连线，直观展示“距离” */}
            <line
              x1={sx(c.circle_center.x)}
              y1={sy(c.circle_center.y)}
              x2={cx}
              y2={cy}
              className="distance-line"
            />
            {isFirst ? (
              <polygon
                points={`${cx},${cy - size - 2} ${cx + size},${cy + size - 2} ${cx - size},${cy + size - 2}`}
                className="first-hit"
                data-testid="first-collision-marker"
              />
            ) : (
              <circle cx={cx} cy={cy} r={size} className="other-hit" />
            )}
            <text x={cx + size + 3} y={cy - size - 3} className="svg-label hit-label">
              线段{c.segment_index}/孔{c.circle_index}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
