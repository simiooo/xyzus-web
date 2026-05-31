import { Carousel, Typography } from 'antd'

const { Text } = Typography

interface BannerItem {
  id: string
  image?: string
  voiceover?: string
  url?: string
}

interface HeroBannerProps {
  items: BannerItem[]
}

export default function HeroBanner({ items }: HeroBannerProps) {
  if (!items || items.length === 0) return null

  return (
    <div className="mb-5 rounded-2xl overflow-hidden">
      <Carousel autoplay autoplaySpeed={5000} dotPosition="bottom">
        {items.map((item) => (
          <div key={item.id}>
            <div className="relative h-[180px] md:h-[220px] cursor-pointer">
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  className="w-full h-full object-cover brightness-[0.75]"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
              {item.voiceover && (
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                  <Text className="!text-white text-sm leading-tight line-clamp-2">
                    {item.voiceover}
                  </Text>
                </div>
              )}
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  )
}
