import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentSoft,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="photo"
        options={{
          title: "Photo",
          tabBarIcon: ({ color, size }) => <TabIcon name="image-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="room"
        options={{
          title: "3D Room",
          tabBarIcon: ({ color, size }) => <TabIcon name="cube-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ar"
        options={{
          title: "Live AR",
          tabBarIcon: ({ color, size }) => <TabIcon name="scan-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <TabIcon name="grid-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
