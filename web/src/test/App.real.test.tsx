import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { App } from "../App";
import { API_BASE } from "../api/client";

/**
 * 验收约定：这些用例通过真实 fetch 调用运行中的 API（由 verify 服务启动）。
 * VITE_APIBASE 指向 API 根地址（默认 http://localhost:8000）。
 * 若 API 不可达则失败而不是跳过——保证“真实请求”被实际核对。
 */
const BASE = API_BASE || "http://localhost:8000";

beforeAll(async () => {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw new Error(`验收要求真实 API 在线：${BASE} 不可达`);
});

async function submit() {
  await userEvent.click(screen.getByTestId("submit"));
}

describe("真实请求 + 录入 + 高亮（App）", () => {
  it("录入节点/禁入圈顺序并真实请求：相切场景判定不可敷设且突出首个碰撞", async () => {
    render(<App />);

    // 默认示例：节点 (-100,0)->(100,0)，电缆半径 5，孔圆心 (0,15) 半径 10
    // 圆心距折线 15 == 扩张半径 15 -> 相切即碰撞
    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("banner-collision")).toBeInTheDocument(),
    );
    // SVG 中出现扩张圈、禁入圈、首个碰撞星标与判定连线
    expect(screen.getByTestId("forbidden-circle-0")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-circle-0")).toBeInTheDocument();
    expect(screen.getByTestId("first-collision-marker")).toBeInTheDocument();
    expect(screen.getByTestId("collision-0-0")).toBeInTheDocument();

    const detail = screen.getByTestId("first-collision-detail").textContent ?? "";
    expect(detail).toContain("线段 #0");
    expect(detail).toContain("禁入圈 #0");
    expect(detail).toContain("(0, 0)"); // 最近点为 (0,0)
    expect(detail).toContain("15"); // 距离=扩张半径
  });

  it("调整为可敷设路线后显示“可敷设”，并清除旧碰撞高亮", async () => {
    render(<App />);
    await userEvent.clear(screen.getByTestId("circle-0-y"));
    await userEvent.type(screen.getByTestId("circle-0-y"), "30"); // 距离30 > 15
    await submit();

    await waitFor(() => expect(screen.getByTestId("banner-ok")).toBeInTheDocument());
    expect(screen.getByTestId("banner-ok").textContent).toContain("可敷设");
    expect(screen.queryByTestId("first-collision-marker")).not.toBeInTheDocument();
  });

  it("多处碰撞：突出首个，并列出其余（按线段/禁入圈升序）", async () => {
    render(<App />);
    // 增加一个节点，形成两段；再增加第二个孔
    await userEvent.click(screen.getByTestId("add-node"));
    const n2x = screen.getByTestId("node-2-x");
    const n2y = screen.getByTestId("node-2-y");
    await userEvent.clear(n2x);
    await userEvent.type(n2x, "100");
    await userEvent.clear(n2y);
    await userEvent.type(n2y, "100");

    await userEvent.click(screen.getByTestId("add-circle"));
    const c1x = screen.getByTestId("circle-1-x");
    const c1y = screen.getByTestId("circle-1-y");
    const c1r = screen.getByTestId("circle-1-radius");
    await userEvent.clear(c1x);
    await userEvent.type(c1x, "100");
    await userEvent.clear(c1y);
    await userEvent.type(c1y, "50"); // 线段1 穿过
    await userEvent.clear(c1r);
    await userEvent.type(c1r, "10");

    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("banner-collision")).toBeInTheDocument(),
    );
    // 首个：线段0 × 孔0；其余列表含 线段1 × 孔1
    const rest = screen.getByTestId("rest-collisions");
    expect(rest.textContent).toContain("线段 #1");
    expect(rest.textContent).toContain("禁入圈 #1");
    // 两个碰撞标记都在图上，首个为星标
    expect(screen.getByTestId("collision-0-0")).toBeInTheDocument();
    expect(screen.getByTestId("collision-1-1")).toBeInTheDocument();
  });

  it("非法输入（非正半径）不发请求，返回字段级错误并清除旧结论", async () => {
    render(<App />);
    // 先得到一个碰撞结论
    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("banner-collision")).toBeInTheDocument(),
    );

    // 改成非法半径
    await userEvent.clear(screen.getByTestId("cable-radius"));
    await userEvent.type(screen.getByTestId("cable-radius"), "0");
    await submit();

    await waitFor(() => expect(screen.getByTestId("banner-error")).toBeInTheDocument());
    expect(screen.getByTestId("err-cable_radius").textContent).toContain("正数");
    // 旧结论被清除：画布与碰撞横幅都不存在
    expect(screen.queryByTestId("banner-collision")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
  });

  it("相邻重复节点触发字段错误（录入顺序被保留在列表中）", async () => {
    render(<App />);
    await userEvent.clear(screen.getByTestId("node-1-x"));
    await userEvent.type(screen.getByTestId("node-1-x"), "-100");
    // 节点1 变为 (-100,0) 与节点0 重复
    await submit();
    await waitFor(() => expect(screen.getByTestId("banner-error")).toBeInTheDocument());
    const nodeList = screen.getByTestId("node-list");
    // 两行录入仍按输入顺序存在
    expect(within(nodeList).getAllByText(/#\d/).length).toBeGreaterThanOrEqual(2);
  });
});
