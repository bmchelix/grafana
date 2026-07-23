// BMC Change: This entire file is added for bidirectional RTL/LTR support
import React, { createContext, useContext, useMemo } from 'react';

export type Direction = 'ltr' | 'rtl';

interface DirectionContextValue {
  direction: Direction;
  isRtl: boolean;
}

const DirectionContext = createContext<DirectionContextValue | undefined>(undefined);

interface DirectionProviderProps {
  direction: Direction;
  children: React.ReactNode;
  /**
   * If true, wraps children in a div with the dir attribute.
   * If false, only provides context without a wrapper element.
   * Default: true
   */
  withWrapper?: boolean;
  /**
   * Additional className for the wrapper div (only used when withWrapper is true)
   */
  className?: string;
  /**
   * Additional style for the wrapper div (only used when withWrapper is true)
   */
  style?: React.CSSProperties;
}

/**
 * DirectionProvider - Provides direction context for bidirectional layout support.
 *
 * Use this to create sections of your app with different text directions.
 * Components inside can use `useDirection()` hook to get the current direction.
 *
 * @example
 * // RTL section within an LTR app
 * <DirectionProvider direction="rtl">
 *   <MyComponent /> // This component and its children will be RTL
 * </DirectionProvider>
 *
 * @example
 * // LTR section within an RTL app
 * <DirectionProvider direction="ltr">
 *   <MyComponent /> // This component and its children will be LTR
 * </DirectionProvider>
 */
export function DirectionProvider({
  direction,
  children,
  withWrapper = true,
  className,
  style,
}: DirectionProviderProps) {
  const value = useMemo<DirectionContextValue>(
    () => ({
      direction,
      isRtl: direction === 'rtl',
    }),
    [direction]
  );

  if (withWrapper) {
    return (
      <DirectionContext.Provider value={value}>
        <div dir={direction} className={className} style={style}>
          {children}
        </div>
      </DirectionContext.Provider>
    );
  }

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}

/**
 * Hook to get the current direction from context.
 *
 * Falls back to checking the DOM if no context is available.
 *
 * @example
 * const { direction, isRtl } = useDirection();
 * const marginStyle = isRtl ? { marginRight: 8 } : { marginLeft: 8 };
 */
export function useDirection(): DirectionContextValue {
  const context = useContext(DirectionContext);

  if (context) {
    return context;
  }

  // Fallback: check document direction
  const docDir = typeof document !== 'undefined' ? document.documentElement.getAttribute('dir') : 'ltr';
  const direction: Direction = docDir === 'rtl' ? 'rtl' : 'ltr';

  return {
    direction,
    isRtl: direction === 'rtl',
  };
}

/**
 * Hook to get directional values based on current direction.
 *
 * @example
 * const { getDirectionalValue, getDirectionalStyle } = useDirectionalStyles();
 *
 * // Get different values for LTR/RTL
 * const icon = getDirectionalValue('arrow-left', 'arrow-right');
 *
 * // Get directional CSS properties
 * const style = getDirectionalStyle({
 *   marginLeft: 8,      // becomes marginRight in RTL
 *   paddingRight: 16,   // becomes paddingLeft in RTL
 * });
 */
export function useDirectionalStyles() {
  const { isRtl } = useDirection();

  const getDirectionalValue = <T,>(ltrValue: T, rtlValue: T): T => {
    return isRtl ? rtlValue : ltrValue;
  };

  /**
   * Flips directional CSS properties for RTL.
   * Handles: left/right, marginLeft/marginRight, paddingLeft/paddingRight,
   * borderLeft/borderRight, textAlign
   */
  const getDirectionalStyle = (style: React.CSSProperties): React.CSSProperties => {
    if (!isRtl) {
      return style;
    }

    const flipped: React.CSSProperties = {};

    for (const [key, value] of Object.entries(style)) {
      const flippedKey = flipStyleKey(key);
      const flippedValue = flipStyleValue(key, value);
      // @ts-ignore - dynamic key assignment
      flipped[flippedKey] = flippedValue;
    }

    return flipped;
  };

  return {
    isRtl,
    getDirectionalValue,
    getDirectionalStyle,
  };
}

// Helper to flip CSS property names
function flipStyleKey(key: string): string {
  const keyFlipMap: Record<string, string> = {
    left: 'right',
    right: 'left',
    marginLeft: 'marginRight',
    marginRight: 'marginLeft',
    paddingLeft: 'paddingRight',
    paddingRight: 'paddingLeft',
    borderLeft: 'borderRight',
    borderRight: 'borderLeft',
    borderLeftWidth: 'borderRightWidth',
    borderRightWidth: 'borderLeftWidth',
    borderLeftColor: 'borderRightColor',
    borderRightColor: 'borderLeftColor',
    borderLeftStyle: 'borderRightStyle',
    borderRightStyle: 'borderLeftStyle',
    borderTopLeftRadius: 'borderTopRightRadius',
    borderTopRightRadius: 'borderTopLeftRadius',
    borderBottomLeftRadius: 'borderBottomRightRadius',
    borderBottomRightRadius: 'borderBottomLeftRadius',
  };

  return keyFlipMap[key] || key;
}

// Helper to flip CSS property values
function flipStyleValue(key: string, value: unknown): unknown {
  if (key === 'textAlign') {
    if (value === 'left') return 'right';
    if (value === 'right') return 'left';
  }

  if (key === 'float') {
    if (value === 'left') return 'right';
    if (value === 'right') return 'left';
  }

  if (key === 'clear') {
    if (value === 'left') return 'right';
    if (value === 'right') return 'left';
  }

  // For transform with translateX, we might want to negate
  // But this is complex, so we leave it to the caller

  return value;
}

/**
 * Utility to detect direction from DOM element.
 * Useful when context is not available.
 *
 * @param element - The DOM element to check
 * @returns The computed direction of the element
 */
export function getElementDirection(element: HTMLElement | null): Direction {
  if (!element) {
    return typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
  }

  // Check computed style for direction
  const computedDir = window.getComputedStyle(element).direction;
  return computedDir === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * Hook to get directional CSS class names.
 * Useful for applying different classes based on direction.
 *
 * @example
 * const { dirClass, getDirectionalClass } = useDirectionalClass();
 *
 * // Get the current direction as a class name
 * <div className={dirClass}> // 'rtl' or 'ltr'
 *
 * // Get direction-specific class
 * <div className={getDirectionalClass('my-component-ltr', 'my-component-rtl')}>
 */
export function useDirectionalClass() {
  const { direction, isRtl } = useDirection();

  const getDirectionalClass = (ltrClass: string, rtlClass: string): string => {
    return isRtl ? rtlClass : ltrClass;
  };

  return {
    dirClass: direction,
    isRtl,
    getDirectionalClass,
  };
}

/**
 * Hook that returns props to spread on an element for direction support.
 *
 * @example
 * const dirProps = useDirectionProps();
 * <div {...dirProps}>Content with direction attribute</div>
 */
export function useDirectionProps(): { dir: Direction } {
  const { direction } = useDirection();
  return { dir: direction };
}

/**
 * Higher-order component that provides direction context to a component.
 *
 * @example
 * const MyDirectionalComponent = withDirection(MyComponent);
 * // MyComponent will receive { direction, isRtl } props
 */
export function withDirection<P extends object>(
  WrappedComponent: React.ComponentType<P & DirectionContextValue>
): React.FC<Omit<P, keyof DirectionContextValue>> {
  const WithDirectionComponent: React.FC<Omit<P, keyof DirectionContextValue>> = (props) => {
    const directionContext = useDirection();
    return <WrappedComponent {...(props as P)} {...directionContext} />;
  };

  WithDirectionComponent.displayName = `withDirection(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithDirectionComponent;
}

/**
 * Utility to create CSS-in-JS styles that automatically flip for RTL.
 * Works with inline styles, not Emotion CSS.
 *
 * @param styles - Style object with LTR values
 * @param isRtl - Whether to flip for RTL
 * @returns Flipped style object if isRtl is true
 *
 * @example
 * const { isRtl } = useDirection();
 * const style = flipStyles({ marginLeft: 8, paddingRight: 16 }, isRtl);
 * // In RTL: { marginRight: 8, paddingLeft: 16 }
 */
export function flipStyles(styles: React.CSSProperties, isRtl: boolean): React.CSSProperties {
  if (!isRtl) {
    return styles;
  }

  const flipped: React.CSSProperties = {};

  for (const [key, value] of Object.entries(styles)) {
    const flippedKey = flipStyleKey(key);
    const flippedValue = flipStyleValue(key, value);
    // @ts-ignore - dynamic key assignment
    flipped[flippedKey] = flippedValue;
  }

  return flipped;
}

/**
 * Utility to get start/end values based on direction.
 * Useful for logical CSS properties.
 *
 * @example
 * const { isRtl } = useDirection();
 * const { start, end } = getLogicalValues(isRtl);
 * // In LTR: start = 'left', end = 'right'
 * // In RTL: start = 'right', end = 'left'
 */
export function getLogicalValues(isRtl: boolean): { start: 'left' | 'right'; end: 'left' | 'right' } {
  return {
    start: isRtl ? 'right' : 'left',
    end: isRtl ? 'left' : 'right',
  };
}
