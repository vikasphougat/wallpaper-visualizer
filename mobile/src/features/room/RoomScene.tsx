import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";
import { useTexture } from "@react-three/drei/native";

export type WallId = "back" | "left" | "right";
export type LightingPreset = "apartment" | "daylight" | "evening";
export type RoomSizePreset = "cozy" | "standard" | "wide";
export type FloorStyle = "wood" | "tile" | "carpet";

const ROOM_SIZES: Record<RoomSizePreset, [number, number, number]> = {
  cozy: [3.2, 2.5, 3.2],
  standard: [4, 2.7, 4],
  wide: [5.5, 2.8, 4.5],
};

const FLOOR_COLORS: Record<FloorStyle, number> = {
  wood: 0x6f6257,
  tile: 0x9a9590,
  carpet: 0x4a5568,
};

type Props = {
  textureUrl: string;
  papered: WallId[];
  paintColor: string;
  scale: number;
  rotationDeg: number;
  roomSize: RoomSizePreset;
  floorStyle: FloorStyle;
  lighting: LightingPreset;
  furniture: boolean;
  shadows: boolean;
};

function Wall({
  w,
  h,
  position,
  rotation,
  texture,
  papered,
  paintColor,
  repeat,
  rotationRad,
}: {
  w: number;
  h: number;
  position: [number, number, number];
  rotation: [number, number, number];
  texture: THREE.Texture;
  papered: boolean;
  paintColor: string;
  repeat: [number, number];
  rotationRad: number;
}) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: paintColor,
      roughness: 0.92,
      metalness: 0,
    });
    if (papered) {
      const t = texture.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
      t.rotation = rotationRad;
      t.needsUpdate = true;
      m.map = t;
    }
    return m;
  }, [papered, paintColor, texture, repeat, rotationRad]);

  return (
    <mesh position={position} rotation={rotation} receiveShadow castShadow material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

export function RoomScene({
  textureUrl,
  papered,
  paintColor,
  scale,
  rotationDeg,
  roomSize,
  floorStyle,
  lighting,
  furniture,
  shadows,
}: Props) {
  const [w, h, d] = ROOM_SIZES[roomSize];
  const texture = useTexture(textureUrl);
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();

  const repeat = useMemo((): [number, number] => {
    const base = 4 / Math.max(0.3, scale);
    return [base, base * 0.7];
  }, [scale]);

  const rotationRad = (rotationDeg * Math.PI) / 180;
  const paperedSet = useMemo(() => new Set(papered), [papered]);

  useEffect(() => {
    camera.position.set(0, h * 0.55, d * 0.95);
    camera.lookAt(0, h * 0.45, -d * 0.2);
  }, [camera, h, d]);

  useEffect(() => {
    const presets = {
      apartment: { ambient: 0.55, key: 0.9, hemi: 0.5 },
      daylight: { ambient: 0.75, key: 1.25, hemi: 0.8 },
      evening: { ambient: 0.35, key: 0.7, hemi: 0.3 },
    }[lighting];
    if (keyRef.current) keyRef.current.intensity = presets.key;
  }, [lighting]);

  useFrame((_, delta) => {
    camera.updateProjectionMatrix();
    void delta;
  });

  return (
    <>
      <color attach="background" args={["#12151c"]} />
      <ambientLight intensity={lighting === "evening" ? 0.35 : lighting === "daylight" ? 0.75 : 0.55} />
      <hemisphereLight intensity={0.5} groundColor="#404040" />
      <directionalLight
        ref={keyRef}
        position={[w * 0.6, h * 1.6, d * 0.6]}
        intensity={0.9}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={FLOOR_COLORS[floorStyle]} roughness={0.95} />
      </mesh>

      <Wall
        w={w}
        h={h}
        position={[0, h / 2, -d / 2]}
        rotation={[0, 0, 0]}
        texture={texture}
        papered={paperedSet.has("back")}
        paintColor={paintColor}
        repeat={repeat}
        rotationRad={rotationRad}
      />
      <Wall
        w={d}
        h={h}
        position={[-w / 2, h / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        texture={texture}
        papered={paperedSet.has("left")}
        paintColor={paintColor}
        repeat={repeat}
        rotationRad={rotationRad}
      />
      <Wall
        w={d}
        h={h}
        position={[w / 2, h / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        texture={texture}
        papered={paperedSet.has("right")}
        paintColor={paintColor}
        repeat={repeat}
        rotationRad={rotationRad}
      />

      {furniture && (
        <group position={[0, 0, -d * 0.15]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.6, 0.8, 0.7]} />
            <meshStandardMaterial color="#5c4a3a" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.05, -0.35]} castShadow>
            <boxGeometry args={[1.6, 0.9, 0.12]} />
            <meshStandardMaterial color="#6b5a4a" roughness={0.8} />
          </mesh>
        </group>
      )}
    </>
  );
}
