import { Typography } from 'antd'
import { RightOutlined } from '@ant-design/icons'

const { Text } = Typography

interface SectionHeaderProps {
  title: string
  onViewAll?: () => void
}

export default function SectionHeader({ title, onViewAll }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <Text strong className="!text-primary" style={{ fontSize: 18 }}>
        {title}
      </Text>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs text-tertiary hover:!text-accent-primary transition-colors bg-none border-none cursor-pointer"
        >
          View all <RightOutlined style={{ fontSize: 10 }} />
        </button>
      )}
    </div>
  )
}
