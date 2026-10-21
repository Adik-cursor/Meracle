type ProductImageThumbProps = {
  imageUrl?: string
  name: string
  size?: 'sm' | 'md' | 'identity'
}

export function ProductImageThumb({
  imageUrl,
  name,
  size = 'sm',
}: ProductImageThumbProps) {
  const className = `product-photo product-photo--${size}`

  if (imageUrl) {
    return <img className={className} src={imageUrl} alt={name} />
  }

  return (
    <div className={`${className} product-photo--placeholder`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </div>
  )
}
