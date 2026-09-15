import { cn } from '../../utils/helpers'

function BrandLogo({ className, alt = 'Логотип ННМЦ' }) {
  return (
    <img
      src='/nnmc-logo.png'
      alt={alt}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}

export default BrandLogo
