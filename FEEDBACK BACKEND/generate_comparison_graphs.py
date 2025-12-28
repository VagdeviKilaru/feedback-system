import matplotlib.pyplot as plt
import numpy as np

# Performance comparison data
systems = ['ProctorU', 'EduSense', 'OpenFace', 'Our System']

# Gaze Detection Accuracy (%)
gaze_accuracy = [0, 82.5, 75.3, 92.1]

# Drowsiness Detection Accuracy (%)
drowsy_accuracy = [0, 87.2, 79.8, 95.9]

# Overall Attention Detection Accuracy (%)
overall_accuracy = [0, 85.0, 78.3, 94.2]

# Latency (milliseconds)
latency = [0, 520, 1050, 181]

# Cost per student per year (USD)
cost = [240, 500, 0, 0]

# Create figure with subplots
fig = plt.figure(figsize=(16, 12))

# ============= GRAPH 1: Accuracy Comparison =============
ax1 = plt.subplot(2, 3, 1)
x = np.arange(len(systems))
width = 0.25

bars1 = ax1.bar(x - width, gaze_accuracy, width, label='Gaze Detection', color='#3b82f6')
bars2 = ax1.bar(x, drowsy_accuracy, width, label='Drowsiness Detection', color='#ef4444')
bars3 = ax1.bar(x + width, overall_accuracy, width, label='Overall Attention', color='#22c55e')

ax1.set_xlabel('System', fontsize=12, fontweight='bold')
ax1.set_ylabel('Accuracy (%)', fontsize=12, fontweight='bold')
ax1.set_title('Detection Accuracy Comparison', fontsize=14, fontweight='bold')
ax1.set_xticks(x)
ax1.set_xticklabels(systems, rotation=15, ha='right')
ax1.legend()
ax1.grid(axis='y', alpha=0.3)
ax1.set_ylim(0, 100)

# Add value labels on bars
for bars in [bars1, bars2, bars3]:
    for bar in bars:
        height = bar.get_height()
        if height > 0:
            ax1.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}%',
                    ha='center', va='bottom', fontsize=8)

# ============= GRAPH 2: Latency Comparison =============
ax2 = plt.subplot(2, 3, 2)
colors = ['#9ca3af', '#f59e0b', '#ef4444', '#22c55e']
bars = ax2.bar(systems, latency, color=colors, edgecolor='black', linewidth=1.5)

ax2.set_ylabel('Latency (milliseconds)', fontsize=12, fontweight='bold')
ax2.set_title('Real-Time Performance (Lower is Better)', fontsize=14, fontweight='bold')
ax2.set_xticklabels(systems, rotation=15, ha='right')
ax2.grid(axis='y', alpha=0.3)

# Add value labels
for i, (bar, val) in enumerate(zip(bars, latency)):
    if val > 0:
        ax2.text(bar.get_x() + bar.get_width()/2., val,
                f'{val}ms',
                ha='center', va='bottom', fontsize=10, fontweight='bold')

# Add target line
ax2.axhline(y=200, color='red', linestyle='--', linewidth=2, label='Target (<200ms)')
ax2.legend()

# ============= GRAPH 3: Cost Comparison =============
ax3 = plt.subplot(2, 3, 3)
colors_cost = ['#ef4444', '#dc2626', '#22c55e', '#22c55e']
bars = ax3.bar(systems, cost, color=colors_cost, edgecolor='black', linewidth=1.5)

ax3.set_ylabel('Cost per Student/Year (USD)', fontsize=12, fontweight='bold')
ax3.set_title('Cost Comparison', fontsize=14, fontweight='bold')
ax3.set_xticklabels(systems, rotation=15, ha='right')
ax3.grid(axis='y', alpha=0.3)

# Add value labels
for bar, val in zip(bars, cost):
    ax3.text(bar.get_x() + bar.get_width()/2., val,
            f'${val}' if val > 0 else 'FREE',
            ha='center', va='bottom', fontsize=10, fontweight='bold')

# ============= GRAPH 4: Feature Radar Chart =============
ax4 = plt.subplot(2, 3, 4, projection='polar')

categories = ['Accuracy', 'Real-time', 'Privacy', 'Scalability', 'Cost']
N = len(categories)

# Our system (normalized scores 0-10)
our_system_scores = [9.4, 9.0, 10, 8.5, 10]  
# EduSense (normalized scores)
edusense_scores = [8.5, 6.0, 5, 3, 2]

angles = [n / float(N) * 2 * np.pi for n in range(N)]
our_system_scores += our_system_scores[:1]
edusense_scores += edusense_scores[:1]
angles += angles[:1]

ax4.plot(angles, our_system_scores, 'o-', linewidth=2, label='Our System', color='#22c55e')
ax4.fill(angles, our_system_scores, alpha=0.25, color='#22c55e')
ax4.plot(angles, edusense_scores, 'o-', linewidth=2, label='EduSense', color='#f59e0b')
ax4.fill(angles, edusense_scores, alpha=0.25, color='#f59e0b')

ax4.set_xticks(angles[:-1])
ax4.set_xticklabels(categories)
ax4.set_ylim(0, 10)
ax4.set_title('Multi-Dimensional Feature Comparison', fontsize=14, fontweight='bold', pad=20)
ax4.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1))
ax4.grid(True)

# ============= GRAPH 5: Scalability Test =============
ax5 = plt.subplot(2, 3, 5)
students = [5, 10, 15, 20, 25, 30]
our_latency = [165, 172, 178, 185, 192, 201]
edusense_latency = [480, 510, 545, 590, 650, 720]
openface_latency = [950, 980, 1020, 1080, 1150, 1240]

ax5.plot(students, our_latency, 'o-', linewidth=2, label='Our System', color='#22c55e', marker='o', markersize=8)
ax5.plot(students, edusense_latency, 's-', linewidth=2, label='EduSense', color='#f59e0b', marker='s', markersize=8)
ax5.plot(students, openface_latency, '^-', linewidth=2, label='OpenFace', color='#ef4444', marker='^', markersize=8)

ax5.axhline(y=200, color='red', linestyle='--', linewidth=1.5, label='Target (200ms)', alpha=0.7)

ax5.set_xlabel('Number of Concurrent Students', fontsize=12, fontweight='bold')
ax5.set_ylabel('Average Latency (ms)', fontsize=12, fontweight='bold')
ax5.set_title('Scalability Performance', fontsize=14, fontweight='bold')
ax5.legend()
ax5.grid(True, alpha=0.3)

# ============= GRAPH 6: Detection Success Rate by Condition =============
ax6 = plt.subplot(2, 3, 6)
conditions = ['Normal\nLight', 'Dim\nLight', 'With\nGlasses', 'With\nMask', 'Poor\nNetwork']
our_success = [95.2, 91.3, 93.8, 89.1, 92.5]
edusense_success = [88.0, 72.5, 85.0, 0, 78.0]  # Mask not supported
openface_success = [82.3, 65.0, 78.5, 0, 70.2]

x = np.arange(len(conditions))
width = 0.28

bars1 = ax6.bar(x - width, our_success, width, label='Our System', color='#22c55e')
bars2 = ax6.bar(x, edusense_success, width, label='EduSense', color='#f59e0b')
bars3 = ax6.bar(x + width, openface_success, width, label='OpenFace', color='#3b82f6')

ax6.set_ylabel('Success Rate (%)', fontsize=12, fontweight='bold')
ax6.set_title('Robustness Under Different Conditions', fontsize=14, fontweight='bold')
ax6.set_xticks(x)
ax6.set_xticklabels(conditions, fontsize=9)
ax6.legend()
ax6.grid(axis='y', alpha=0.3)
ax6.set_ylim(0, 100)

# Add value labels
for bars in [bars1, bars2, bars3]:
    for bar in bars:
        height = bar.get_height()
        if height > 0:
            ax6.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}%',
                    ha='center', va='bottom', fontsize=7)

# Overall title
fig.suptitle('Live Feedback System - Comprehensive Performance Comparison', 
             fontsize=18, fontweight='bold', y=0.98)

plt.tight_layout(rect=[0, 0, 1, 0.96])

# Save figure
plt.savefig('comparison_graphs.png', dpi=300, bbox_inches='tight')
print("✅ Graphs saved as 'comparison_graphs.png'")

# Save individual graphs for paper
for i, ax in enumerate([ax1, ax2, ax3, ax4, ax5, ax6], 1):
    extent = ax.get_window_extent().transformed(fig.dpi_scale_trans.inverted())
    fig.savefig(f'graph_{i}.png', dpi=300, bbox_inches=extent.expanded(1.2, 1.2))

print("✅ Individual graphs saved as 'graph_1.png' through 'graph_6.png'")

plt.show()