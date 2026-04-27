export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type MapMarkerPoint = {
  x: number;
  y: number;
};

export type MapNode = {
  id: string;
  title: string;
  summary: string;
  coordinate: GeoPoint;
  marker: MapMarkerPoint;
  radiusMeters: number;
  photoTargets: string[];
  postcard: {
    id: string;
    title: string;
    caption: string;
    imageTone: 'warm-river' | 'mist-blue' | 'leaf-gold';
  };
};

export type MapNodeWithDistance = MapNode & {
  distanceMeters: number;
  isReachable: boolean;
};

export type NodeTaskStatus = 'active' | 'completed' | 'skipped';

export type NodeTaskState = {
  nodeId: string;
  status: NodeTaskStatus;
  requiredTargets: string[];
  capturedTargets: string[];
  completedAt?: number;
};

export type PostcardReward = {
  id: string;
  nodeId: string;
  title: string;
  caption: string;
  imageTone: MapNode['postcard']['imageTone'];
  capturedCount: number;
  shareText: string;
};
