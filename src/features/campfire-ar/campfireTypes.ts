export type CampfireKind = 'official' | 'user';

export type CampfireComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type CampfireNote = {
  id: string;
  kind: CampfireKind;
  ownerId?: string;
  title: string;
  body: string;
  x: number;
  y: number;
  z: number;
  comments: CampfireComment[];
  createdAt: string;
};

