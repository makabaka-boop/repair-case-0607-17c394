export interface Point {
  x: number;
  y: number;
}

export interface Collision {
  segment_index: number;
  circle_index: number;
  nearest: Point;
  distance: number;
  expanded_radius: number;
  circle_center: Point;
  circle_radius: number;
  cable_radius: number;
}

export interface CircleView {
  center: Point;
  radius: number;
  expanded_radius: number;
}

export interface PrecheckResponse {
  feasible: boolean;
  cable_radius: number;
  nodes: Point[];
  circles: CircleView[];
  collision_count: number;
  first_collision: Collision | null;
  collisions: Collision[];
}

export interface PrecheckPayload {
  nodes: Point[];
  cable_radius: number;
  circles: Array<Point & { radius: number }>;
}

export type FieldErrors = Record<string, string>;
