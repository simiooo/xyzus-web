import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  Card, Typography, Button, Skeleton, Divider, Tag, Empty, Input, message, Tooltip, Modal,
} from 'antd'
import {
  ArrowLeftOutlined, HeartOutlined, HeartFilled, StarOutlined, StarFilled,
  MessageOutlined, LikeOutlined, LikeFilled, DeleteOutlined,
  CaretRightOutlined, PauseOutlined,
} from '@ant-design/icons'
import DOMPurify from 'dompurify'
import { episodeDetailAPI, favoriteEpisodeUpdateAPI } from '@/api/episode'
import {
  commentPrimaryAPI, commentThreadAPI, commentCreateAPI,
  commentLikeUpdateAPI, commentRemoveAPI,
  commentCollectCreateAPI, commentCollectRemoveAPI,
} from '@/api/comment'
import useAuthStore from '@/stores/authStore'
import useAudioStore from '@/stores/audioStore'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { formatDate, formatDuration } from '@/utils/format'
import type { EpisodeDetail, Comment as CommentType, CommentPrimaryLoadMoreKey } from '@/api/types'

const { Title, Text, Paragraph } = Typography

function CommentItem({ comment, onRefresh, currentUserId }: { comment: CommentType; onRefresh: () => void; currentUserId: string | undefined }) {
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [replies, setReplies] = useState<CommentType[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)

  const handleLike = async () => {
    try {
      await commentLikeUpdateAPI({ id: comment.id, liked: !comment.liked, type: 'COMMENT' })
      onRefresh()
    } catch { message.error('Operation failed') }
  }

  const handleCollect = async () => {
    try {
      if (comment.collected) {
        await commentCollectRemoveAPI({ commentId: comment.id })
      } else {
        await commentCollectCreateAPI({ commentId: comment.id })
      }
      onRefresh()
    } catch { message.error('Operation failed') }
  }

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete comment',
      content: 'Are you sure you want to delete this comment?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await commentRemoveAPI({ commentId: comment.id })
          message.success('Deleted')
          onRefresh()
        } catch { message.error('Delete failed') }
      },
    })
  }

  const handleReply = async () => {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      await commentCreateAPI({
        id: comment.pid,
        type: 'EPISODE',
        text: replyText.trim(),
        replyToCommentId: comment.id,
      })
      message.success('Reply posted')
      setReplyText('')
      setShowReplyInput(false)
      onRefresh()
    } catch { message.error('Failed to reply') } finally { setReplying(false) }
  }

  const loadReplies = async () => {
    if (replies.length > 0) { setShowReplies(!showReplies); return }
    setLoadingReplies(true)
    try {
      const res = await commentThreadAPI({ primaryCommentId: comment.id, order: 'SMART' })
      setReplies(res.data || [])
      setShowReplies(true)
    } catch { message.error('Failed to load replies') } finally { setLoadingReplies(false) }
  }

  const isOwnComment = currentUserId && comment.author.uid === currentUserId

  return (
    <div className="py-2">
      <div className="flex gap-2.5">
        <img
          src={comment.author.avatar?.picture?.thumbnailUrl}
          alt=""
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Text strong className="!text-primary" style={{ fontSize: 13 }}>{comment.author.nickname}</Text>
            {comment.ipLoc && <Text className="!text-tertiary" style={{ fontSize: 11 }}>{comment.ipLoc}</Text>}
            <Text className="!text-tertiary" style={{ fontSize: 11 }}>{formatDate(comment.createdAt, { hour: '2-digit', minute: '2-digit' })}</Text>
          </div>
          <Paragraph className="!text-primary" style={{ margin: '4px 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {comment.text}
          </Paragraph>
          <div className="flex gap-4 items-center">
            <Tooltip title={comment.liked ? 'Unlike' : 'Like'}>
              <Button type="text" size="small" icon={comment.liked ? <LikeFilled style={{ color: '#FF7A45' }} /> : <LikeOutlined />} onClick={handleLike}>
                {comment.likeCount > 0 && <Text style={{ fontSize: 12, marginLeft: 2 }}>{comment.likeCount}</Text>}
              </Button>
            </Tooltip>
            <Tooltip title={comment.collected ? 'Unsave' : 'Save'}>
              <Button type="text" size="small" icon={comment.collected ? <StarFilled style={{ color: '#36CFC9' }} /> : <StarOutlined />} onClick={handleCollect} />
            </Tooltip>
            <Button type="text" size="small" icon={<MessageOutlined />} onClick={() => setShowReplyInput(!showReplyInput)}>
              {(comment.threadReplyCount ?? 0) > 0 && <Text style={{ fontSize: 12, marginLeft: 2 }}>{comment.threadReplyCount}</Text>}
            </Button>
            {isOwnComment && (
              <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#FF4D4F' }} onClick={handleDelete} />
            )}
          </div>

          {showReplyInput && (
            <div className="mt-2 flex gap-2">
              <Input
                size="small"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onPressEnter={handleReply}
                className="flex-1"
              />
              <Button size="small" type="primary" loading={replying} onClick={handleReply}>Send</Button>
            </div>
          )}

          {(comment.threadReplyCount ?? 0) > 0 && (
            <Button type="link" size="small" className="!p-0 mt-1" onClick={loadReplies}>
              {showReplies ? 'Hide replies' : `View ${comment.threadReplyCount} replies`}
            </Button>
          )}

          {showReplies && (
            <div className="ml-4 mt-2 border-l-2 border-border-subtle pl-3">
              {loadingReplies ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                replies.map((reply) => (
                  <CommentItem key={reply.id} comment={reply} onRefresh={onRefresh} currentUserId={currentUserId} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <Divider className="!border-border-subtle" style={{ margin: '4px 0' }} />
    </div>
  )
}

export default function EpisodeDetail() {
  const { eid } = useParams<{ eid: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [episode, setEpisode] = useState<EpisodeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { currentEpisode, isPlaying, play, togglePlay } = useAudioStore()

  const [favorited, setFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)

  const [comments, setComments] = useState<CommentType[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentOrder, setCommentOrder] = useState<'HOT' | 'TIME' | 'TIMESTAMP'>('HOT')
  const [commentLoadMoreKey, setCommentLoadMoreKey] = useState<CommentPrimaryLoadMoreKey | undefined>()
  const [commentHasMore, setCommentHasMore] = useState(true)

  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const genRef = useRef(0)

  const loadEpisode = useCallback(async () => {
    if (!eid) { setError('Episode ID is missing'); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const result = await episodeDetailAPI({ eid })
      const data = result.data
      setEpisode(data)
      setFavorited(data.isFavorited)
      setFavoriteCount(data.favoriteCount)
    } catch {
      setError('Failed to load episode')
    } finally {
      setLoading(false)
    }
  }, [eid])

  const loadComments = useCallback(async () => {
    if (!eid) return
    const gen = ++genRef.current
    setCommentsLoading(true)
    try {
      const res = await commentPrimaryAPI({ id: eid, order: commentOrder })
      if (gen === genRef.current) {
        setComments(res.data || [])
        setCommentLoadMoreKey(res.loadMoreKey)
        setCommentHasMore(!!res.loadMoreKey)
      }
    } catch {
      if (gen === genRef.current) message.error('Failed to load comments')
    } finally {
      if (gen === genRef.current) setCommentsLoading(false)
    }
  }, [eid, commentOrder])

  const loadMoreComments = useCallback(async () => {
    if (!eid || !commentLoadMoreKey) return
    const gen = ++genRef.current
    try {
      const res = await commentPrimaryAPI({ id: eid, order: commentOrder, loadMoreKey: commentLoadMoreKey })
      if (gen === genRef.current) {
        setComments((prev) => [...prev, ...(res.data || [])])
        setCommentLoadMoreKey(res.loadMoreKey)
        setCommentHasMore(!!res.loadMoreKey)
      }
    } catch {
      if (gen === genRef.current) message.error('Failed to load more comments')
    }
  }, [eid, commentOrder, commentLoadMoreKey])

  const sentinelRef = useInfiniteScroll(loadMoreComments, { enabled: commentHasMore })

  useEffect(() => { loadEpisode() }, [loadEpisode])
  useEffect(() => { if (eid) loadComments() }, [loadComments])

  const handleFavorite = async () => {
    if (!eid) return
    const newFavorited = !favorited
    setFavorited(newFavorited)
    setFavoriteCount((c) => c + (newFavorited ? 1 : -1))
    try {
      await favoriteEpisodeUpdateAPI({ eid, favorited: newFavorited })
    } catch {
      setFavorited(!newFavorited)
      setFavoriteCount((c) => c + (!newFavorited ? 1 : -1))
      message.error('Operation failed')
    }
  }

  const handleCommentSubmit = async () => {
    if (!eid || !newComment.trim() || submittingComment) return
    setSubmittingComment(true)
    const text = newComment.trim()
    setNewComment('')
    try {
      await commentCreateAPI({ id: eid, type: 'EPISODE', text })
      message.success('Comment posted')
      loadComments()
    } catch {
      setNewComment(text)
      message.error('Failed to post comment')
    } finally { setSubmittingComment(false) }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer rounded-xl h-48" />
        <div className="shimmer rounded-xl h-32" />
      </div>
    )
  }

  if (error || !episode) {
    return (
      <div className="text-center py-16">
        <Empty description={error || 'Episode not found'} />
        <Button type="primary" onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
      </div>
    )
  }

  const sanitizedShownotes = episode.shownotes
    ? DOMPurify.sanitize(episode.shownotes, {
        ALLOWED_TAGS: ['p', 'br', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'img'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel'],
      })
    : ''

  const coverUrl = episode.image?.largePicUrl || episode.image?.picUrl || episode.podcast?.image?.largePicUrl

  return (
    <div className="flex flex-col h-[calc(100vh-(76px+68px))]">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="mb-3 flex-shrink-0 self-start">
        Back
      </Button>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <Card bordered={false} className="bg-surface rounded-lg border border-subtle flex-1 flex flex-col min-h-0 overflow-hidden"
            styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } }}
          >
            {coverUrl ? (
              <div className="relative flex-shrink-0">
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-[280px] object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16">
                  <Title level={4} className="!text-white !m-0">{episode.title}</Title>
                  <Text
                    className="!text-accent-primary !text-white/90 cursor-pointer"
                    onClick={() => navigate(`/podcast/${episode.podcast?.pid}`)}
                  >
                    {episode.podcast?.title}
                  </Text>
                  <div className="mt-1 flex gap-4 flex-wrap text-xs text-white/70">
                    <span>{formatDate(episode.pubDate, { year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {episode.duration > 0 && <span>{formatDuration(episode.duration)}</span>}
                    <span>{episode.playCount.toLocaleString()} plays</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 flex-shrink-0">
                <Title level={4} className="!text-primary !m-0">{episode.title}</Title>
                <Text
                  className="!text-accent-primary cursor-pointer"
                  onClick={() => navigate(`/podcast/${episode.podcast?.pid}`)}
                >
                  {episode.podcast?.title}
                </Text>
                <div className="mt-1 flex gap-4 flex-wrap text-xs">
                  <Text className="!text-tertiary">{formatDate(episode.pubDate, { year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  {episode.duration > 0 && <Text className="!text-tertiary">{formatDuration(episode.duration)}</Text>}
                  <Text className="!text-tertiary">{episode.playCount.toLocaleString()} plays</Text>
                </div>
              </div>
            )}

            <div className="flex gap-3 px-5 pt-3 pb-2 flex-shrink-0">
              <Button
                type="primary"
                icon={currentEpisode?.eid === episode.eid && isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
                onClick={() => {
                  if (currentEpisode?.eid === episode.eid) {
                    togglePlay()
                  } else {
                    play(episode)
                  }
                }}
                className="!rounded-full !px-5"
              >
                {currentEpisode?.eid === episode.eid && isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button
                type="text"
                icon={favorited ? <HeartFilled style={{ color: '#FF4D4F' }} /> : <HeartOutlined />}
                onClick={handleFavorite}
              >
                {favoriteCount.toLocaleString()}
              </Button>
              <Button type="text" icon={<MessageOutlined />}>
                {episode.commentCount}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5 scrollbar-thin">
              {episode.description && (
                <div className="mb-4">
                  <Text strong className="!text-primary">Description</Text>
                  <Paragraph className="!text-secondary mt-1" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                    {episode.description}
                  </Paragraph>
                </div>
              )}

              {sanitizedShownotes && (
                <div>
                  <Text strong className="!text-primary">Show Notes</Text>
                  <div
                    className="shownotes-content mt-1 text-sm leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.65)' }}
                    dangerouslySetInnerHTML={{ __html: sanitizedShownotes }}
                  />
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="w-[400px] flex flex-col flex-shrink-0">
          <Card bordered={false} className="bg-surface rounded-lg border border-subtle flex-1 flex flex-col min-h-0"
            styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' } }}
          >
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <Title level={5} className="!text-primary !m-0">Comments</Title>
              <div className="flex gap-2">
                {(['HOT', 'TIME', 'TIMESTAMP'] as const).map((order) => (
                  <Tag
                    key={order}
                    color={commentOrder === order ? 'orange' : 'default'}
                    className="cursor-pointer"
                    onClick={() => { setCommentOrder(order); setCommentLoadMoreKey(undefined); setCommentHasMore(true) }}
                  >
                    {order === 'HOT' ? 'Hot' : order === 'TIME' ? 'Latest' : 'Timestamp'}
                  </Tag>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-4 flex-shrink-0">
              <Input
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onPressEnter={handleCommentSubmit}
              />
              <Button type="primary" loading={submittingComment} onClick={handleCommentSubmit}>Post</Button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
              {commentsLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : comments.length === 0 ? (
                <Empty description={<span className="text-secondary">No comments yet</span>} />
              ) : (
                <>
                  {comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} onRefresh={loadComments} currentUserId={user?.uid} />
                  ))}
                  {commentHasMore && <div ref={sentinelRef} className="h-[1px]" />}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
