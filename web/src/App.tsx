import { useState } from "react";
import { precheck, ValidationError } from "./api/client";
import { Scene } from "./components/Scene";
import {
  buildPayload,
  validateDraft,
  type CircleDraft,
  type FormDraft,
  type NodeDraft,
} from "./lib/validation";
import type { FieldErrors, PrecheckResponse } from "./types";
import "./App.css";

const err = (errors: FieldErrors, key: string) => errors[key];
const hasErr = (errors: FieldErrors, key: string) => Boolean(errors[key]);

function NumInput(props: {
  value: string;
  testid: string;
  ariaLabel: string;
  invalid?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className={`num-input${props.invalid ? " invalid" : ""}`}
      value={props.value}
      aria-label={props.ariaLabel}
      data-testid={props.testid}
      inputMode="decimal"
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

const initialDraft: FormDraft = {
  cableRadius: "5",
  nodes: [
    { x: "-100", y: "0" },
    { x: "100", y: "0" },
  ],
  circles: [{ x: "0", y: "15", radius: "10" }],
};

export function App() {
  const [draft, setDraft] = useState<FormDraft>(initialDraft);
  const [result, setResult] = useState<PrecheckResponse | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateNode = (i: number, patch: Partial<NodeDraft>) => {
    setDraft((d) => ({
      ...d,
      nodes: d.nodes.map((n, idx) => (idx === i ? { ...n, ...patch } : n)),
    }));
  };
  const updateCircle = (i: number, patch: Partial<CircleDraft>) => {
    setDraft((d) => ({
      ...d,
      circles: d.circles.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 任何新的提交都先清除旧结论与错误。
    setResult(null);
    setErrors({});
    setNetworkError(null);

    const fieldErrors = validateDraft(draft);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors); // 非法输入：整次预检不保留旧结论
      return;
    }

    setLoading(true);
    try {
      const data = await precheck(buildPayload(draft));
      setResult(data);
    } catch (e) {
      if (e instanceof ValidationError) {
        // 服务端字段级错误（与本地错误键一致）
        setErrors(e.errors);
      } else {
        setNetworkError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDraft(initialDraft);
    setResult(null);
    setErrors({});
    setNetworkError(null);
  };

  // 后端按 (线段下标, 禁入圈输入顺序) 确定首个碰撞；页面必须直接使用该结果，
  // 不能再按距离自行改排，否则“首个”和“其余”会与接口明细不一致。
  const first = result?.first_collision ?? null;
  const rest = result ? result.collisions.slice(1) : [];

  return (
    <div className="page">
      <header className="header">
        <h1>隧道电缆绕孔预检器</h1>
        <p className="subtitle">
          电缆折线绕开钻孔作业面时，按「孔半径 + 电缆半径」的扩张安全圈逐线段检测；
          距离 ≤ 扩张半径即碰撞（含相切），判定位置为圆心到线段的最近点。
        </p>
      </header>

      <main className="layout">
        <form className="panel form" onSubmit={handleSubmit} noValidate>
          <section>
            <h2>电缆半径（毫米，正数）</h2>
            <NumInput
              value={draft.cableRadius}
              testid="cable-radius"
              ariaLabel="电缆半径（毫米）"
              invalid={hasErr(errors, "cable_radius")}
              onChange={(v) => setDraft((d) => ({ ...d, cableRadius: v }))}
            />
            {err(errors, "cable_radius") && (
              <p className="field-error" data-testid="err-cable_radius">
                {err(errors, "cable_radius")}
              </p>
            )}
          </section>

          <section>
            <div className="row-head">
              <h2>路径节点（整数毫米，按输入顺序）</h2>
              <button
                type="button"
                className="btn small"
                data-testid="add-node"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    nodes: [...d.nodes, { x: "0", y: "0" }],
                  }))
                }
              >
                + 节点
              </button>
            </div>
            {hasErr(errors, "nodes") && (
              <p className="field-error" data-testid="err-nodes">
                {err(errors, "nodes")}
              </p>
            )}
            <ol className="rows" data-testid="node-list">
              {draft.nodes.map((node, i) => (
                <li key={i} className="row">
                  <span className="row-index">#{i}</span>
                  <NumInput
                    value={node.x}
                    testid={`node-${i}-x`}
                    ariaLabel={`节点 ${i} X 坐标`}
                    invalid={hasErr(errors, `nodes[${i}].x`)}
                    onChange={(v) => updateNode(i, { x: v })}
                  />
                  <NumInput
                    value={node.y}
                    testid={`node-${i}-y`}
                    ariaLabel={`节点 ${i} Y 坐标`}
                    invalid={hasErr(errors, `nodes[${i}].y`)}
                    onChange={(v) => updateNode(i, { y: v })}
                  />
                  <button
                    type="button"
                    className="btn ghost small"
                    aria-label={`删除节点 ${i}`}
                    data-testid={`remove-node-${i}`}
                    disabled={draft.nodes.length <= 1}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        nodes: d.nodes.filter((_, idx) => idx !== i),
                      }))
                    }
                  >
                    删除
                  </button>
                  {(err(errors, `nodes[${i}].x`) || err(errors, `nodes[${i}].y`)) && (
                    <p className="field-error row-error">
                      {err(errors, `nodes[${i}].x`) ?? err(errors, `nodes[${i}].y`)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <div className="row-head">
              <h2>禁入圈（圆心整数毫米，半径正数）</h2>
              <button
                type="button"
                className="btn small"
                data-testid="add-circle"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    circles: [...d.circles, { x: "0", y: "0", radius: "10" }],
                  }))
                }
              >
                + 禁入圈
              </button>
            </div>
            <ol className="rows" data-testid="circle-list">
              {draft.circles.map((c, i) => (
                <li key={i} className="row">
                  <span className="row-index">#{i}</span>
                  <NumInput
                    value={c.x}
                    testid={`circle-${i}-x`}
                    ariaLabel={`禁入圈 ${i} 圆心 X`}
                    invalid={hasErr(errors, `circles[${i}].x`)}
                    onChange={(v) => updateCircle(i, { x: v })}
                  />
                  <NumInput
                    value={c.y}
                    testid={`circle-${i}-y`}
                    ariaLabel={`禁入圈 ${i} 圆心 Y`}
                    invalid={hasErr(errors, `circles[${i}].y`)}
                    onChange={(v) => updateCircle(i, { y: v })}
                  />
                  <NumInput
                    value={c.radius}
                    testid={`circle-${i}-radius`}
                    ariaLabel={`禁入圈 ${i} 半径`}
                    invalid={hasErr(errors, `circles[${i}].radius`)}
                    onChange={(v) => updateCircle(i, { radius: v })}
                  />
                  <button
                    type="button"
                    className="btn ghost small"
                    aria-label={`删除禁入圈 ${i}`}
                    data-testid={`remove-circle-${i}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        circles: d.circles.filter((_, idx) => idx !== i),
                      }))
                    }
                  >
                    删除
                  </button>
                  {(err(errors, `circles[${i}].x`) ||
                    err(errors, `circles[${i}].y`) ||
                    err(errors, `circles[${i}].radius`)) && (
                    <p className="field-error row-error">
                      {err(errors, `circles[${i}].x`) ??
                        err(errors, `circles[${i}].y`) ??
                        err(errors, `circles[${i}].radius`)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <div className="actions">
            <button type="submit" className="btn primary" data-testid="submit" disabled={loading}>
              {loading ? "预检中…" : "开始预检"}
            </button>
            <button type="button" className="btn ghost" data-testid="reset" onClick={handleReset}>
              重置示例
            </button>
          </div>

          {networkError && (
            <p className="field-error" data-testid="network-error">
              请求失败：{networkError}
            </p>
          )}
        </form>

        <section className="panel result">
          {!result && Object.keys(errors).length === 0 && !networkError && (
            <div className="placeholder" data-testid="placeholder">
              <p>填写路径节点、电缆半径与禁入圈后点击「开始预检」。</p>
              <p className="hint">判定值四舍五入显示至三位小数，计算内部使用双精度。</p>
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="banner error" data-testid="banner-error">
              <strong>预检未执行：</strong>
              存在 {Object.keys(errors).length} 个字段错误，旧结论已清除。请修正红色字段后重试。
            </div>
          )}

          {result && result.feasible && (
            <div className="banner ok" data-testid="banner-ok">
              <strong>✅ 可敷设</strong>
              <span>所有线段均在扩张安全圈之外（相切亦视为碰撞）。</span>
            </div>
          )}

          {result && !result.feasible && first && (
            <div className="banner collision" data-testid="banner-collision">
              <strong>⛔ 不可敷设：{result.collision_count} 处碰撞</strong>
              <div className="first-detail" data-testid="first-collision-detail">
                首个碰撞：线段 #{first.segment_index} × 禁入圈 #{first.circle_index}
                ，判定位置（最近点）= ({first.nearest.x}, {first.nearest.y}) mm，
                圆心距离 = {first.distance} mm ≤ 扩张半径 {first.expanded_radius} mm。
              </div>
              {rest.length > 0 && (
                <details open className="rest-list">
                  <summary>其余 {rest.length} 处碰撞（升序）</summary>
                  <ul data-testid="rest-collisions">
                    {rest.map((c) => (
                      <li key={`${c.segment_index}-${c.circle_index}`}>
                        线段 #{c.segment_index} × 禁入圈 #{c.circle_index}：
                        判定位置 ({c.nearest.x}, {c.nearest.y})，距离 {c.distance} ≤{" "}
                        {c.expanded_radius}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {result && (
            <>
              <Scene result={result} />
              <p className="legend">
                <span className="lg lg-solid" /> 禁入圈（孔半径）
                <span className="lg lg-dashed" /> 扩张安全圈（孔半径+电缆半径）
                <span className="lg lg-star" /> 首个碰撞判定位置
                <span className="lg lg-dot" /> 其余碰撞
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
