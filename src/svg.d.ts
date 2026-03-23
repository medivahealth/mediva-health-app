declare module '*.svg' {
  import type { ComponentType } from 'react';
  import type { SvgProps } from 'react-native-svg';

  /** SVG imports via react-native-svg-transformer */
  const content: ComponentType<SvgProps>;
  export default content;
}

