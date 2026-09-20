"""二维碰撞几何计算（双精度）。

判定规则：
对每条闭线段（含端点），求圆心到该线段的**唯一最近点**及其距离；
当双精度 ``distance <= 禁入圈半径 + 电缆半径`` 时判定碰撞，
最近点统一作为判定位置。相切（恰好相等）亦判碰撞。

三位小数舍入只用于接口展示，不能参与碰撞判定；每个
「线段 × 禁入圈」组合都是独立结果，即使两条线段在公共端点的最近点重合也不去重。
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Sequence, Tuple

Point = Tuple[float, float]


@dataclass(frozen=True)
class Collision:
    segment_index: int
    circle_index: int
    nearest: Point       # 判定位置：圆心到线段的最近点
    distance: float      # 圆心到最近点的距离（双精度）
    expanded_radius: float  # 禁入圈半径 + 电缆半径


def nearest_point_on_segment(p: Point, a: Point, b: Point) -> Tuple[Point, float]:
    """返回点 ``p`` 到闭线段 ``a-b`` 的唯一最近点与距离。

    参数 t 为最近点在线段上的比例，裁剪到 [0, 1]：
    t<=0 取端点 a，t>=1 取端点 b，否则为线段内部的垂足。
    端点/整段位于圈内时，最近点同样落在线段上，规则统一适用。
    """
    px, py = p
    ax, ay = a
    bx, by = b
    dx = bx - ax
    dy = by - ay
    length_sq = dx * dx + dy * dy
    # 调用方已保证相邻节点不重复，这里对退化线段做防御处理。
    if length_sq == 0.0:
        qx, qy = ax, ay
    else:
        t = ((px - ax) * dx + (py - ay) * dy) / length_sq
        if t <= 0.0:
            qx, qy = ax, ay
        elif t >= 1.0:
            qx, qy = bx, by
        else:
            qx = ax + t * dx
            qy = ay + t * dy
    ddx = px - qx
    ddy = py - qy
    distance = math.hypot(ddx, ddy)
    return (qx, qy), distance


def detect_collisions(
    nodes: Sequence[Point],
    circles: Sequence[Tuple[Point, float]],
    cable_radius: float,
) -> List[Collision]:
    """对所有「线段 × 禁入圈」做检测。

    结果按 (线段下标, 禁入圈输入顺序) 升序返回。
    碰撞判据使用 ``<=``，故相切边界稳定地判为碰撞。
    """
    results: List[Collision] = []
    for seg_idx in range(len(nodes) - 1):
        a = nodes[seg_idx]
        b = nodes[seg_idx + 1]
        for cir_idx, (center, circle_r) in enumerate(circles):
            nearest, distance = nearest_point_on_segment(center, a, b)
            expanded = circle_r + cable_radius
            if distance <= expanded:
                results.append(
                    Collision(
                        segment_index=seg_idx,
                        circle_index=cir_idx,
                        nearest=nearest,
                        distance=distance,
                        expanded_radius=expanded,
                    )
                )
    return results
