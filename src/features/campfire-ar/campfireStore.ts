import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { CampfireComment, CampfireKind, CampfireNote } from './campfireTypes';

type CampfireNoteRow = {
  body: string;
  created_at: string;
  id: string;
  kind: CampfireKind;
  owner_id: string | null;
  scene: string;
  title: string;
  x: number;
  y: number;
  z: number;
};

type CampfireCommentRow = {
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  note_id: string;
  parent_comment_id: string | null;
  scene: string;
};

type CampfireLikeRow = {
  created_at: string;
  note_id: string;
  scene: string;
  visitor_id: string;
};

let supabaseClient: SupabaseClient | null = null;

function getSupabaseConfig() {
  const env = import.meta.env;
  if (env.MODE === 'test') {
    return null;
  }

  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { anonKey, url };
}

export function isCampfireCloudConfigured() {
  return getSupabaseConfig() !== null;
}

function getSupabase() {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(config.url, config.anonKey);
  }

  return supabaseClient;
}

function toCampfireNote(
  row: CampfireNoteRow,
  comments: CampfireComment[],
  likeCount: number,
  likedByVisitor: boolean
): CampfireNote {
  return {
    id: row.id,
    kind: row.kind,
    ownerId: row.owner_id ?? undefined,
    title: row.title,
    body: row.body,
    x: row.x,
    y: row.y,
    z: row.z,
    comments,
    createdAt: row.created_at,
    likedByVisitor,
    likeCount,
  };
}

function toCampfireComment(row: CampfireCommentRow): CampfireComment {
  return {
    authorId: row.author_id ?? undefined,
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    parentCommentId: row.parent_comment_id ?? undefined,
  };
}

export async function fetchCloudCampfires(scene: string, visitorId: string) {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const [notesResult, commentsResult, likesResult] = await Promise.all([
    supabase.from('campfire_notes').select('*').eq('scene', scene).order('created_at', { ascending: true }),
    supabase.from('campfire_comments').select('*').eq('scene', scene).order('created_at', { ascending: true }),
    supabase.from('campfire_note_likes').select('*').eq('scene', scene),
  ]);

  if (notesResult.error) {
    throw notesResult.error;
  }

  if (commentsResult.error) {
    throw commentsResult.error;
  }

  if (likesResult.error) {
    throw likesResult.error;
  }

  const commentsByNote = new Map<string, CampfireComment[]>();
  const commentRows = (commentsResult.data ?? []) as CampfireCommentRow[];
  const noteRows = (notesResult.data ?? []) as CampfireNoteRow[];
  const likeRows = (likesResult.data ?? []) as CampfireLikeRow[];
  const likeCounts = new Map<string, number>();
  const likedByCurrentVisitor = new Set<string>();

  for (const row of likeRows) {
    likeCounts.set(row.note_id, (likeCounts.get(row.note_id) ?? 0) + 1);
    if (row.visitor_id === visitorId) {
      likedByCurrentVisitor.add(row.note_id);
    }
  }

  for (const row of commentRows) {
    const comments = commentsByNote.get(row.note_id) ?? [];
    comments.push(toCampfireComment(row));
    commentsByNote.set(row.note_id, comments);
  }

  return noteRows.map((row) =>
    toCampfireNote(row, commentsByNote.get(row.id) ?? [], likeCounts.get(row.id) ?? 0, likedByCurrentVisitor.has(row.id))
  );
}

export async function saveCloudCampfire(scene: string, note: CampfireNote) {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from('campfire_notes').upsert(
    {
      body: note.body,
      created_at: note.createdAt,
      id: note.id,
      kind: note.kind,
      owner_id: note.ownerId ?? null,
      scene,
      title: note.title,
      x: note.x,
      y: note.y,
      z: note.z,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }

  return true;
}

export async function deleteCloudCampfire(campfireId: string) {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from('campfire_notes').delete().eq('id', campfireId).eq('kind', 'user');
  if (error) {
    throw error;
  }

  return true;
}

export async function saveCloudComment(scene: string, campfireId: string, comment: CampfireComment) {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from('campfire_comments').insert({
    author_id: comment.authorId ?? null,
    author_name: comment.authorName,
    body: comment.body,
    created_at: comment.createdAt,
    id: comment.id,
    note_id: campfireId,
    parent_comment_id: comment.parentCommentId ?? null,
    scene,
  });

  if (error) {
    throw error;
  }

  return true;
}

export async function saveCloudCampfireLike(scene: string, campfireId: string, visitorId: string) {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from('campfire_note_likes').upsert(
    {
      note_id: campfireId,
      scene,
      visitor_id: visitorId,
    },
    { onConflict: 'note_id,visitor_id' }
  );

  if (error) {
    throw error;
  }

  return true;
}

export async function deleteCloudCampfireLike(campfireId: string, visitorId: string) {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from('campfire_note_likes')
    .delete()
    .eq('note_id', campfireId)
    .eq('visitor_id', visitorId);

  if (error) {
    throw error;
  }

  return true;
}

export function subscribeCloudCampfires(scene: string, onRemoteChange: () => void) {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  let channel: RealtimeChannel | null = supabase
    .channel(`campfire-notes:${scene}`)
    .on(
      'postgres_changes',
      { event: '*', filter: `scene=eq.${scene}`, schema: 'public', table: 'campfire_notes' },
      onRemoteChange
    )
    .on(
      'postgres_changes',
      { event: '*', filter: `scene=eq.${scene}`, schema: 'public', table: 'campfire_comments' },
      onRemoteChange
    )
    .on(
      'postgres_changes',
      { event: '*', filter: `scene=eq.${scene}`, schema: 'public', table: 'campfire_note_likes' },
      onRemoteChange
    )
    .subscribe();

  return () => {
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}
