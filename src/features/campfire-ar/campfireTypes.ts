export type CampfireKind = 'official' | 'user';

export type CampfireComment = {
  authorId?: string;
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  parentCommentId?: string;
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
  likedByVisitor: boolean;
  likeCount: number;
};
