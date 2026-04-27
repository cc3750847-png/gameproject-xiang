import type {
  GeoPoint,
  MapNode,
  MapNodeWithDistance,
  NodeTaskState,
  PostcardReward,
} from './types';

export const PHOTO_TASK_REQUIRED_COUNT = 3;

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMeters(from: GeoPoint, to: GeoPoint) {
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

export function getMapNodesWithDistance(nodes: MapNode[], playerLocation: GeoPoint): MapNodeWithDistance[] {
  return nodes.map((node) => {
    const distanceMeters = calculateDistanceMeters(playerLocation, node.coordinate);

    return {
      ...node,
      distanceMeters,
      isReachable: distanceMeters <= node.radiusMeters,
    };
  });
}

export function getNearestReachableNode(nodes: MapNode[], playerLocation: GeoPoint) {
  return getMapNodesWithDistance(nodes, playerLocation)
    .filter((node) => node.isReachable)
    .sort((first, second) => first.distanceMeters - second.distanceMeters)[0];
}

export function createInitialNodeTaskState(node: MapNode): NodeTaskState {
  return {
    nodeId: node.id,
    status: 'active',
    requiredTargets: node.photoTargets.slice(0, PHOTO_TASK_REQUIRED_COUNT),
    capturedTargets: [],
  };
}

export function recordPhotoCapture(task: NodeTaskState, target: string, capturedAt = Date.now()): NodeTaskState {
  if (task.status !== 'active' || !task.requiredTargets.includes(target) || task.capturedTargets.includes(target)) {
    return task;
  }

  const capturedTargets = [...task.capturedTargets, target];
  const isComplete = capturedTargets.length >= PHOTO_TASK_REQUIRED_COUNT;

  return {
    ...task,
    status: isComplete ? 'completed' : 'active',
    capturedTargets,
    completedAt: isComplete ? capturedAt : task.completedAt,
  };
}

export function skipNodeTask(task: NodeTaskState): NodeTaskState {
  return {
    ...task,
    status: 'skipped',
    capturedTargets: [],
    completedAt: undefined,
  };
}

export function createPostcardReward(node: MapNode, task: NodeTaskState): PostcardReward | null {
  if (task.status !== 'completed') {
    return null;
  }

  return {
    ...node.postcard,
    nodeId: node.id,
    capturedCount: task.capturedTargets.length,
    shareText: `我在${node.title}完成了三处景物拍照，获得「${node.postcard.title}」。`,
  };
}
