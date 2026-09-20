import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Scene } from "./Scene";
import type { PrecheckResponse } from "../types";

const orderedCollisionsResult: PrecheckResponse = {
  feasible: false,
  cable_radius: 1,
  nodes: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
  ],
  circles: [
    { center: { x: 5, y: 2 }, radius: 1.1, expanded_radius: 2.1 },
    { center: { x: 15, y: 0 }, radius: 1, expanded_radius: 2 },
  ],
  collision_count: 2,
  first_collision: {
    segment_index: 0,
    circle_index: 0,
    nearest: { x: 5, y: 0 },
    distance: 2,
    expanded_radius: 2.1,
    circle_center: { x: 5, y: 2 },
    circle_radius: 1.1,
    cable_radius: 1,
  },
  collisions: [
    {
      segment_index: 0,
      circle_index: 0,
      nearest: { x: 5, y: 0 },
      distance: 2,
      expanded_radius: 2.1,
      circle_center: { x: 5, y: 2 },
      circle_radius: 1.1,
      cable_radius: 1,
    },
    {
      segment_index: 1,
      circle_index: 1,
      nearest: { x: 15, y: 0 },
      distance: 0,
      expanded_radius: 2,
      circle_center: { x: 15, y: 0 },
      circle_radius: 1,
      cable_radius: 1,
    },
  ],
};

describe("Scene", () => {
  it("突出接口返回的首个碰撞，而不是按距离自行改选", () => {
    const { getByTestId } = render(<Scene result={orderedCollisionsResult} />);

    const firstGroup = getByTestId("collision-0-0");
    expect(within(firstGroup).getByTestId("first-collision-marker")).toBeInTheDocument();

    const deeperGroup = getByTestId("collision-1-1");
    expect(within(deeperGroup).queryByTestId("first-collision-marker")).not.toBeInTheDocument();
    expect(deeperGroup.querySelector(".other-hit")).toBeInTheDocument();
  });

  it("视窗完整纳入扩张安全圈，避免巨大安全边界落在画布外", () => {
    const result: PrecheckResponse = {
      feasible: false,
      cable_radius: 100,
      nodes: [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
      circles: [
        {
          center: { x: 0, y: 0 },
          radius: 1,
          expanded_radius: 101,
        },
      ],
      collision_count: 1,
      first_collision: {
        segment_index: 0,
        circle_index: 0,
        nearest: { x: 0, y: 0 },
        distance: 0,
        expanded_radius: 101,
        circle_center: { x: 0, y: 0 },
        circle_radius: 1,
        cable_radius: 100,
      },
      collisions: [
        {
          segment_index: 0,
          circle_index: 0,
          nearest: { x: 0, y: 0 },
          distance: 0,
          expanded_radius: 101,
          circle_center: { x: 0, y: 0 },
          circle_radius: 1,
          cable_radius: 100,
        },
      ],
    };

    const { getByTestId } = render(<Scene result={result} />);
    const expanded = getByTestId("expanded-circle-0");

    // 202mm 的安全圈按 480px 可用高度缩放，半径应为 240px，圆周边界贴近视窗边缘。
    expect(Number(expanded.getAttribute("r"))).toBeCloseTo(240);
    expect(Number(expanded.getAttribute("cx"))).toBeCloseTo(280);
    expect(Number(expanded.getAttribute("cy"))).toBeCloseTo(280);
  });
});
