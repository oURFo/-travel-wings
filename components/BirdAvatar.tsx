import React from 'react';
import { BirdType, BirdStatus } from '../types';

interface BirdAvatarProps {
  type: BirdType;
  status: BirdStatus;
  size?: 'sm' | 'md' | 'lg';
}

const BirdAvatar: React.FC<BirdAvatarProps> = ({ type, status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-32 h-32',
    lg: 'w-48 h-48'
  };

  const isFlying = status !== BirdStatus.IDLE && status !== BirdStatus.STAYING;
  
  // Custom SVG Colors based on Type
  const getColors = (t: BirdType) => {
    switch (t) {
      case BirdType.COCKATIEL: return { body: '#FCD34D', cheek: '#EF4444', wing: '#D1D5DB' }; // Yellow body, red cheek
      case BirdType.BLUE_JAY: return { body: '#3B82F6', cheek: '#60A5FA', wing: '#1D4ED8' };
      case BirdType.ROBIN: return { body: '#9CA3AF', cheek: '#EF4444', wing: '#4B5563' }; // Grey body, red breast
      case BirdType.PIGEON: return { body: '#9CA3AF', cheek: '#D1D5DB', wing: '#374151' };
      default: return { body: '#A78BFA', cheek: '#DDD6FE', wing: '#8B5CF6' }; // Sparrow/Generic
    }
  };

  const colors = getColors(type);

  return (
    <div className={`${sizeClasses[size]} relative ${isFlying ? 'animate-fly' : 'animate-float'}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
         {/* Body */}
        <path d="M20,50 Q10,80 50,80 Q90,80 80,50 Q70,20 50,20 Q30,20 20,50" fill={colors.body} />
        
        {/* Crest (for Cockatiel/Blue Jay) */}
        {(type === BirdType.COCKATIEL || type === BirdType.BLUE_JAY) && (
             <path d="M50,20 Q60,5 40,5 L50,20" fill={colors.body} />
        )}

        {/* Belly/Breast */}
        <path d="M30,50 Q50,70 70,50" fill="rgba(255,255,255,0.3)" />

        {/* Wing */}
        <path d="M25,55 Q15,65 30,70 Q50,65 45,50" fill={colors.wing} />

        {/* Eye */}
        <circle cx="65" cy="40" r="4" fill="black" />
        <circle cx="67" cy="38" r="1.5" fill="white" />

        {/* Beak */}
        <path d="M70,40 L80,45 L70,50" fill="#F59E0B" />

        {/* Cheek (Cockatiel specific usually, but cute for all) */}
        <circle cx="60" cy="50" r="5" fill={colors.cheek} opacity="0.6" />

        {/* Feet */}
        <path d="M40,80 L35,90" stroke="#78350F" strokeWidth="3" />
        <path d="M60,80 L65,90" stroke="#78350F" strokeWidth="3" />
      </svg>
      {/* Flight effect lines */}
      {isFlying && (
        <>
            <div className="absolute top-1/2 -left-4 w-6 h-1 bg-white opacity-50 rounded animate-pulse delay-75"></div>
            <div className="absolute top-3/4 -left-2 w-4 h-1 bg-white opacity-40 rounded animate-pulse"></div>
        </>
      )}
    </div>
  );
};

export default BirdAvatar;
