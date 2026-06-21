from PIL import Image
import numpy as np

img = Image.open("/home/user/workspace/monky/attached_assets/monky_original.jpeg").convert("RGBA")
data = np.array(img)

# The background is cream/yellow: high R, high G, lower B
# Detect pixels close to the cream color (~#f5f5c8 / ~#fffff0 range)
r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

# Background is very light: all channels > 200, and R≈G >> B isn't needed
# Actually it's a yellow-cream: R>220, G>220, B>150 and R-B > 50 roughly
# Let's be more precise: flood-fill style — just target the near-white/cream range
cream_mask = (r > 210) & (g > 210) & (b > 180) & (r.astype(int) - b.astype(int) < 80)

# Also catch pure white/near-white
white_mask = (r > 235) & (g > 235) & (b > 235)

combined_mask = cream_mask | white_mask

data[combined_mask] = [0, 0, 0, 0]  # Make transparent

result = Image.fromarray(data)
result.save("/home/user/workspace/monky/attached_assets/monky_logo_transparent.png", "PNG")
print("Saved transparent PNG")

# Check how many pixels became transparent
total = data.shape[0] * data.shape[1]
transparent = np.sum(combined_mask)
print(f"Made {transparent}/{total} pixels transparent ({100*transparent/total:.1f}%)")
