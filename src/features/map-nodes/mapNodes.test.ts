import { describe, expect, it } from 'vitest';
import {
  PHOTO_TASK_REQUIRED_COUNT,
  createInitialNodeTaskState,
  createPostcardReward,
  getMapNodesWithDistance,
  getNearestReachableNode,
  recordPhotoCapture,
  skipNodeTask,
} from './mapNodes';
import type { GeoPoint, MapNode } from './types';

const playerLocation: GeoPoint = {
  latitude: 28.2282,
  longitude: 112.9388,
};

const nodes: MapNode[] = [
  {
    id: 'shore-gate',
    title: '洲头渡口',
    summary: '在渡口确认江风与入口线索。',
    coordinate: {
      latitude: 28.22821,
      longitude: 112.93882,
    },
    marker: {
      x: 24,
      y: 66,
    },
    radiusMeters: 35,
    photoTargets: ['老码头', '水纹', '树影'],
    postcard: {
      id: 'shore-postcard',
      title: '洲头渡口明信片',
      caption: '你把渡口的三处景物留在了回声里。',
      imageTone: 'warm-river',
    },
  },
  {
    id: 'far-bell',
    title: '远钟台',
    summary: '远处的钟声仍在水面回荡。',
    coordinate: {
      latitude: 28.231,
      longitude: 112.941,
    },
    marker: {
      x: 72,
      y: 22,
    },
    radiusMeters: 30,
    photoTargets: ['石阶', '铃影', '树冠'],
    postcard: {
      id: 'bell-postcard',
      title: '远钟台明信片',
      caption: '钟声替你保管了这一段路线。',
      imageTone: 'mist-blue',
    },
  },
];

describe('map node domain', () => {
  it('marks nearby nodes as reachable with meter distances', () => {
    const [nearNode, farNode] = getMapNodesWithDistance(nodes, playerLocation);

    expect(nearNode.distanceMeters).toBeLessThan(5);
    expect(nearNode.isReachable).toBe(true);
    expect(farNode.distanceMeters).toBeGreaterThan(300);
    expect(farNode.isReachable).toBe(false);
  });

  it('returns the nearest reachable node for the current location', () => {
    expect(getNearestReachableNode(nodes, playerLocation)?.id).toBe('shore-gate');
  });

  it('lets users skip a node task without completing the photo objective', () => {
    const skipped = skipNodeTask(createInitialNodeTaskState(nodes[0]));

    expect(skipped.status).toBe('skipped');
    expect(skipped.capturedTargets).toEqual([]);
    expect(skipped.completedAt).toBeUndefined();
  });

  it('completes the node task after capturing the required three scene photos', () => {
    const first = recordPhotoCapture(createInitialNodeTaskState(nodes[0]), '老码头', 1000);
    const second = recordPhotoCapture(first, '水纹', 2000);
    const complete = recordPhotoCapture(second, '树影', 3000);

    expect(PHOTO_TASK_REQUIRED_COUNT).toBe(3);
    expect(complete.status).toBe('completed');
    expect(complete.capturedTargets).toEqual(['老码头', '水纹', '树影']);
    expect(complete.completedAt).toBe(3000);
  });

  it('ignores duplicate photo targets after they have been captured', () => {
    const first = recordPhotoCapture(createInitialNodeTaskState(nodes[0]), '老码头', 1000);
    const duplicate = recordPhotoCapture(first, '老码头', 2000);

    expect(duplicate.capturedTargets).toEqual(['老码头']);
    expect(duplicate.status).toBe('active');
  });

  it('creates a shareable postcard reward from a completed task', () => {
    const complete = nodes[0].photoTargets.reduce(
      (task, target, index) => recordPhotoCapture(task, target, 1000 + index),
      createInitialNodeTaskState(nodes[0])
    );

    expect(createPostcardReward(nodes[0], complete)).toMatchObject({
      id: 'shore-postcard',
      nodeId: 'shore-gate',
      title: '洲头渡口明信片',
      capturedCount: 3,
      shareText: '我在洲头渡口完成了三处景物拍照，获得「洲头渡口明信片」。',
    });
  });
});
