import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroARPlaneSelector,
  ViroARPlane,
  ViroQuad,
  ViroMaterials,
  ViroText,
  ViroTrackingStateConstants,
  ViroNode,
  ViroPinchStateTypes,
  ViroRotateStateTypes,
} from "@reactvision/react-viro";
import type { WallPlacement, PlanePlacementPayload } from "@/types/placement";
import { poseToMatrix4, worldToPlaneLocal } from "@/lib/anchorMath";
import {
  buildWallpaperMaterial,
  materialKeyForPlacement,
  wallpaperUvCoords,
  type AmbientSample,
} from "@/lib/arMaterials";
import { defaultPatchWidthM, DEFAULT_WALL_HEIGHT_M } from "@/lib/physicalScale";
import { applyDrag, applyPinch, applyRotate, applyCornerResize, baselinesFromPlacement, type GestureBaselines } from "./placementGestures";

type ViroAnchor = {
  anchorId: string;
  type: "anchor" | "plane" | "image";
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: [number, number, number];
  width?: number;
  height?: number;
  alignment?: string;
  vertices?: Array<[number, number, number]>;
};

type ViroPlaneAnchor = Parameters<NonNullable<InstanceType<typeof ViroARPlaneSelector>["handleAnchorFound"]>>[0];

function toPlaneAnchor(anchor: ViroAnchor): ViroPlaneAnchor {
  return { ...anchor, scale: anchor.scale ?? [1, 1, 1] } as ViroPlaneAnchor;
}

export type ARSceneProps = {
  textureUrl: string;
  wallpaperId: string;
  physicalRepeatCm: [number, number];
  tileable?: boolean;
  opacity: number;
  scale: number;
  placements: WallPlacement[];
  selectedId: string | null;
  useAnchors: boolean;
  useLighting: boolean;
  ambientLight: AmbientSample | null;
  onTracking: (ok: boolean) => void;
  onAnchorsAvailable: (ok: boolean) => void;
  onAmbientLight: (sample: AmbientSample) => void;
  onPlanePlaced: (payload: PlanePlacementPayload) => void;
  onSelectPlacement: (id: string | null) => void;
  onPlacementChange: (id: string, patch: Partial<WallPlacement>) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
};

function buildPlacementPayload(
  plane: ViroAnchor,
  tapWorld: [number, number, number] | undefined,
  fillW: number,
  fillH: number,
): PlanePlacementPayload {
  const pos = plane.position as [number, number, number];
  const rot = plane.rotation as [number, number, number];
  const local = tapWorld ? worldToPlaneLocal(tapWorld, pos, rot) : ([0, 0, 0] as [number, number, number]);
  const localPosition: [number, number, number] = [local[0], 0, local[2]];
  const width = Math.max(plane.width ?? fillW, 0.25);
  const height = Math.max(plane.height ?? fillH, 0.25);

  return {
    width,
    height,
    anchorId: plane.anchorId,
    localPosition,
    anchorPosition: pos,
    anchorRotation: rot,
    anchorTransform: poseToMatrix4(pos, rot),
  };
}

function InteractivePlacement({
  placement,
  selected,
  ambientLight,
  useLighting,
  onSelect,
  onChange,
  onGestureStart,
  onGestureEnd,
}: {
  placement: WallPlacement;
  selected: boolean;
  ambientLight: AmbientSample | null;
  useLighting: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<WallPlacement>) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}) {
  const gestureBase = useRef<GestureBaselines>(baselinesFromPlacement(placement));
  const repeat = placement.physicalRepeatCm ?? [53, 53];
  const { uvRepeat } = buildWallpaperMaterial({
    textureUrl: placement.textureUrl,
    opacity: placement.opacity,
    physicalRepeatCm: repeat,
    tileable: placement.tileable ?? true,
    patchSizeM: [placement.width, placement.height],
    ambient: ambientLight,
    useLighting,
    selected,
  });

  const quad = (
    <ViroNode position={(placement.localPosition ?? [0, 0, 0]) as [number, number, number]}>
      <ViroQuad
        materials={[materialKeyForPlacement(placement.id)]}
        width={placement.width}
        height={placement.height}
        opacity={placement.opacity}
        rotation={[-90, 0, placement.rotationDeg]}
        uvCoordinates={wallpaperUvCoords(uvRepeat[0], uvRepeat[1])}
        dragType="FixedToWorld"
        onClickState={(state) => {
          if (state === 3) onSelect();
        }}
        onDrag={(pos) => {
          onGestureStart();
          onChange(applyDrag(pos, placement));
        }}
        onPinch={(state, factor) => {
          if (state === ViroPinchStateTypes.PINCH_START) {
            onGestureStart();
            gestureBase.current = baselinesFromPlacement(placement);
          }
          if (state === ViroPinchStateTypes.PINCH_MOVE) {
            onChange(applyPinch(gestureBase.current, factor));
          }
          if (state === ViroPinchStateTypes.PINCH_END) onGestureEnd();
        }}
        onRotate={(state, factor) => {
          if (state === ViroRotateStateTypes.ROTATE_START) {
            onGestureStart();
            gestureBase.current = baselinesFromPlacement(placement);
          }
          if (state === ViroRotateStateTypes.ROTATE_MOVE) {
            onChange(applyRotate(gestureBase.current, factor));
          }
          if (state === ViroRotateStateTypes.ROTATE_END) onGestureEnd();
        }}
      />
      {selected && (
        <>
          <ViroQuad
            width={placement.width * 1.02}
            height={placement.height * 1.02}
            rotation={[-90, 0, placement.rotationDeg]}
            opacity={0.35}
            materials={["selectionOutline"]}
          />
          {(
            [
              ["tl", -placement.width / 2, -placement.height / 2],
              ["tr", placement.width / 2, -placement.height / 2],
              ["bl", -placement.width / 2, placement.height / 2],
              ["br", placement.width / 2, placement.height / 2],
            ] as const
          ).map(([corner, cx, cz]) => (
            <ViroQuad
              key={corner}
              width={0.08}
              height={0.08}
              position={[cx, 0.01, cz]}
              rotation={[-90, 0, 0]}
              materials={["selectionOutline"]}
              dragType="FixedToWorld"
              onDrag={(pos) => {
                onGestureStart();
                gestureBase.current = baselinesFromPlacement(placement);
                onChange(applyCornerResize(gestureBase.current, corner, pos));
              }}
            />
          ))}
        </>
      )}
    </ViroNode>
  );

  // Prefer the captured world pose: a ViroNode locked to a fixed world
  // transform is the most reliable way to keep a placement stuck to the wall.
  // (A second standalone ViroARPlane bound to the same anchor the plane
  // selector already owns does not bind, so its children drift / follow the
  // camera and cannot be touched.)
  if (placement.anchorPosition && placement.anchorRotation) {
    return (
      <ViroNode position={placement.anchorPosition} rotation={placement.anchorRotation}>
        {quad}
      </ViroNode>
    );
  }

  if (placement.anchorId) {
    return <ViroARPlane anchorId={placement.anchorId}>{quad}</ViroARPlane>;
  }

  return <ViroNode position={[0, 0, -0.02]}>{quad}</ViroNode>;
}

function WallARScene(props: ARSceneProps) {
  const {
    textureUrl,
    physicalRepeatCm,
    tileable,
    opacity,
    scale,
    placements,
    selectedId,
    useAnchors,
    useLighting,
    ambientLight,
    onTracking,
    onAnchorsAvailable,
    onAmbientLight,
    onPlanePlaced,
    onSelectPlacement,
    onPlacementChange,
    onGestureStart,
    onGestureEnd,
  } = props;

  const selectorRef = useRef<ViroARPlaneSelector>(null);
  const [planeCount, setPlaneCount] = useState(0);

  const fillW = defaultPatchWidthM(physicalRepeatCm) * Math.max(0.4, scale);
  const fillH = DEFAULT_WALL_HEIGHT_M * Math.max(0.4, scale);

  useEffect(() => {
    const { material: previewMat } = buildWallpaperMaterial({
      textureUrl,
      opacity,
      physicalRepeatCm,
      tileable,
      patchSizeM: [fillW, fillH],
      ambient: ambientLight,
      useLighting,
    });

    const mats: Record<string, object> = {
      wallpaperMat: previewMat,
      selectionOutline: {
        lightingModel: "Constant",
        diffuseColor: "#4da3ff",
        blendMode: "Alpha",
        writesToDepthBuffer: false,
      },
    };

    placements.forEach((p) => {
      const { material: m } = buildWallpaperMaterial({
        textureUrl: p.textureUrl,
        opacity: p.opacity,
        physicalRepeatCm: p.physicalRepeatCm ?? physicalRepeatCm,
        tileable: p.tileable ?? tileable,
        patchSizeM: [p.width, p.height],
        ambient: ambientLight,
        useLighting,
        selected: p.id === selectedId,
      });
      mats[materialKeyForPlacement(p.id)] = m;
    });

    ViroMaterials.createMaterials(mats);
  }, [textureUrl, opacity, physicalRepeatCm, tileable, fillW, fillH, placements, selectedId, ambientLight, useLighting]);

  const previewUv = useMemo(() => {
    const { uvRepeat } = buildWallpaperMaterial({
      textureUrl,
      opacity,
      physicalRepeatCm,
      tileable,
      patchSizeM: [fillW, fillH],
      ambient: ambientLight,
      useLighting,
    });
    return wallpaperUvCoords(uvRepeat[0], uvRepeat[1]);
  }, [textureUrl, opacity, physicalRepeatCm, tileable, fillW, fillH, ambientLight, useLighting]);

  const handleAnchorFound = useCallback(
    (anchor: ViroAnchor) => {
      selectorRef.current?.handleAnchorFound(toPlaneAnchor(anchor));
      if (anchor.type === "plane" && anchor.alignment?.includes("Vertical")) {
        setPlaneCount((c) => c + 1);
        onAnchorsAvailable(true);
      }
    },
    [onAnchorsAvailable],
  );

  const handlePlaneSelected = useCallback(
    (plane: ViroAnchor, tapWorld?: [number, number, number]) => {
      onSelectPlacement(null);
      onPlanePlaced(buildPlacementPayload(plane, tapWorld, fillW, fillH));
      selectorRef.current?.reset();
    },
    [fillW, fillH, onPlanePlaced, onSelectPlacement],
  );

  const previewOpacity = useMemo(() => Math.min(1, opacity * 0.92), [opacity]);

  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesVertical"]}
      onTrackingUpdated={(state) => onTracking(state === ViroTrackingStateConstants.TRACKING_NORMAL)}
      onAnchorFound={handleAnchorFound}
      onAnchorUpdated={(a) => selectorRef.current?.handleAnchorUpdated(toPlaneAnchor(a as ViroAnchor))}
      onAnchorRemoved={(a) => {
        if (a) selectorRef.current?.handleAnchorRemoved(a);
        if (a?.type === "plane") setPlaneCount((c) => Math.max(0, c - 1));
      }}
      onAmbientLightUpdate={(info) => {
        onAmbientLight({ intensity: info.intensity, color: info.color });
      }}
    >
      <ViroText
        text={
          selectedId
            ? "Drag corner dots · pinch · drag · twist"
            : useAnchors
              ? planeCount > 0
                ? "Tap wall · tap patch to select & adjust"
                : "Scan walls · move slowly"
              : "Tap a wall to place wallpaper"
        }
        scale={[0.32, 0.32, 0.32]}
        position={[0, 0.15, -1.1]}
        style={{ fontFamily: "Arial", fontSize: 18, color: "#ffffff", textAlign: "center" }}
      />

      {placements.map((p) => (
        <InteractivePlacement
          key={p.id}
          placement={p}
          selected={p.id === selectedId}
          ambientLight={ambientLight}
          useLighting={useLighting}
          onSelect={() => onSelectPlacement(p.id)}
          onChange={(patch) => onPlacementChange(p.id, patch)}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
        />
      ))}

      <ViroARPlaneSelector
        ref={selectorRef}
        alignment="Vertical"
        minHeight={0.25}
        minWidth={0.25}
        hideOverlayOnSelection={false}
        onPlaneSelected={handlePlaneSelected}
      >
        <ViroQuad
          materials={["wallpaperMat"]}
          width={fillW}
          height={fillH}
          opacity={previewOpacity}
          rotation={[-90, 0, 0]}
          uvCoordinates={previewUv}
        />
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

export function createARScene(props: ARSceneProps) {
  return () => <WallARScene {...props} />;
}

export { ViroARSceneNavigator };
