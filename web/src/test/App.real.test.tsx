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

async function setField(testid: string, value: string) {
  const el = screen.getByTestId(testid);
  await userEvent.clear(el);
  await userEvent.type(el, value);
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
    // 首个为升序首项（线段0 × 孔0），而非侵入更深的 (线段1 × 孔1)
    const firstDetail =
      screen.getByTestId("first-collision-detail").textContent ?? "";
    expect(firstDetail).toContain("线段 #0");
    expect(firstDetail).toContain("禁入圈 #0");
    // 其余列表含 线段1 × 孔1，且不重复首项
    const rest = screen.getByTestId("rest-collisions");
    expect(rest.textContent).toContain("线段 #1");
    expect(rest.textContent).toContain("禁入圈 #1");
    expect(within(rest).getAllByRole("listitem")).toHaveLength(1);
    // 两个碰撞标记都在图上，星标落在首个碰撞分组内
    expect(screen.getByTestId("collision-0-0")).toBeInTheDocument();
    expect(screen.getByTestId("collision-1-1")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("collision-0-0")).getByTestId(
        "first-collision-marker",
      ),
    ).toBeInTheDocument();
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

  it("极近但未侵入安全圈的路线判定为可敷设（双精度判定，不做三位小数比较）", async () => {
    render(<App />);
    // 路径 (0,0)->(1,0)，圆心 (3,10)，电缆 5，孔 5.1978：
    // 最近点 (1,0)，距离 sqrt(104)=10.198039... > 扩张半径 10.1978，
    // 两者三位小数展示值均为 10.198，但按双精度判定应为安全。
    await setField("node-0-x", "0");
    await setField("node-0-y", "0");
    await setField("node-1-x", "1");
    await setField("node-1-y", "0");
    await setField("circle-0-x", "3");
    await setField("circle-0-y", "10");
    await setField("circle-0-radius", "5.1978");
    await submit();

    await waitFor(() => expect(screen.getByTestId("banner-ok")).toBeInTheDocument());
    expect(screen.queryByTestId("banner-collision")).not.toBeInTheDocument();
  });

  it("相邻线段公共端点处的两处碰撞全部返回：数量、排序与明细完整", async () => {
    render(<App />);
    // 路径 (-10,0)->(0,0)->(0,10)，圆心 (1,-1)，孔 0.5，电缆 1：
    // 两条线段最近点都是公共端点 (0,0)，距离 sqrt(2) <= 1.5，各判一次碰撞。
    await setField("node-0-x", "-10");
    await setField("node-0-y", "0");
    await setField("node-1-x", "0");
    await setField("node-1-y", "0");
    await userEvent.click(screen.getByTestId("add-node"));
    await setField("node-2-x", "0");
    await setField("node-2-y", "10");
    await setField("cable-radius", "1");
    await setField("circle-0-x", "1");
    await setField("circle-0-y", "-1");
    await setField("circle-0-radius", "0.5");
    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("banner-collision")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("banner-collision").textContent).toContain("2 处碰撞");
    // 首项为 (线段0, 孔0)，其余列表恰含 (线段1, 孔0) 一项
    const firstDetail =
      screen.getByTestId("first-collision-detail").textContent ?? "";
    expect(firstDetail).toContain("线段 #0");
    expect(firstDetail).toContain("禁入圈 #0");
    const restItems = within(screen.getByTestId("rest-collisions")).getAllByRole(
      "listitem",
    );
    expect(restItems).toHaveLength(1);
    expect(restItems[0].textContent).toContain("线段 #1");
    // 两处碰撞标记都在图上，星标突出首个
    expect(screen.getByTestId("collision-0-0")).toBeInTheDocument();
    expect(screen.getByTestId("collision-1-0")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("collision-0-0")).getByTestId(
        "first-collision-marker",
      ),
    ).toBeInTheDocument();
  });

  it("巨大扩张安全圈完整纳入画布视野", async () => {
    render(<App />);
    // 路径 (-1,0)->(1,0)，孔 (0,0) 半径 1，电缆 100 -> 扩张半径 101。
    await setField("node-0-x", "-1");
    await setField("node-0-y", "0");
    await setField("node-1-x", "1");
    await setField("node-1-y", "0");
    await setField("cable-radius", "100");
    await setField("circle-0-x", "0");
    await setField("circle-0-y", "0");
    await setField("circle-0-radius", "1");
    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("banner-collision")).toBeInTheDocument(),
    );
    // 扩张安全圈（含边界）必须完整落在 880x560 画布内
    const expanded = screen.getByTestId("expanded-circle-0");
    const cx = Number(expanded.getAttribute("cx"));
    const cy = Number(expanded.getAttribute("cy"));
    const r = Number(expanded.getAttribute("r"));
    expect(r).toBeGreaterThan(0);
    expect(cx - r).toBeGreaterThanOrEqual(0);
    expect(cx + r).toBeLessThanOrEqual(880);
    expect(cy - r).toBeGreaterThanOrEqual(0);
    expect(cy + r).toBeLessThanOrEqual(560);
  });
});
