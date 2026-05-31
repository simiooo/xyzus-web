import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Typography, Empty, Row, Col } from 'antd'
import { categoryListAPI, type CategoryInfo } from '@/api/category'

const { Title, Text } = Typography

export default function Categories() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    categoryListAPI()
      .then((result) => setCategories(result.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div>
        <Title level={4} className="!text-primary mb-4">Browse Categories</Title>
        <Row gutter={[12, 12]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col key={i} xs={8} sm={6}>
              <div className="shimmer rounded-lg h-24" />
            </Col>
          ))}
        </Row>
      </div>
    )
  }

  if (categories.length === 0) {
    return <Empty description={<span className="text-secondary">No categories</span>} className="py-16" />
  }

  return (
    <div>
      <Title level={4} className="!text-primary mb-4">Browse Categories</Title>
      <Row gutter={[12, 12]}>
        {categories.map((cat, i) => {
          const gradients = ['gradient-card-blue', 'gradient-card-slate', 'gradient-card-indigo', 'gradient-card-gray']
          const gradient = gradients[i % gradients.length]
          return (
            <Col key={cat.id} xs={8} sm={6}>
              <div
                className={`${gradient} rounded-lg text-center p-4 cursor-pointer card-hover`}
                onClick={() => navigate(`/category/${cat.id}`)}
              >
                <img src={cat.icon.picUrl} alt="" className="w-8 h-8 mx-auto object-contain" />
                <Text className="!text-white block mt-2 text-sm font-semibold">{cat.name}</Text>
              </div>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}
