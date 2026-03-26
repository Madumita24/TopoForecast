# TopoForecast

Topology-augmented reservoir forecasting using deep learning and topological data analysis (TDA).

## Overview

This repository implements a novel forecasting framework that integrates deep neural networks with topological data analysis (TDA) to study and improve long-horizon time series prediction.

A Bidirectional Long Short-Term Memory (BiLSTM) model is trained to forecast reservoir storage. The learned latent representations are then analyzed using zigzag persistent homology, allowing us to capture the evolving geometric structure of temporal dynamics. These topological summaries are incorporated into the forecasting pipeline to enhance performance and interpretability.

## Key Idea

Traditional deep learning models learn latent representations but provide limited insight into their internal structure. This work treats the neural network as a dynamical system, where:

- Hidden states form trajectories in latent space  
- These trajectories exhibit geometric patterns (loops, cycles, manifolds)  
- Topology provides a principled way to quantify this structure  

We extract topological features (H1 persistence) from evolving latent windows and use them as additional signals for forecasting.

## Contributions

- Unified framework combining:
  - Time-series forecasting  
  - Deep recurrent neural networks  
  - Topological data analysis  

- Latent-space analysis using zigzag persistent homology  

- Extraction of dynamic topological descriptors:
  - Number of loops  
  - Maximum persistence  
  - Mean persistence  
  - Persistence entropy  

- Topology-augmented forecasting model  

- Empirical evaluation showing:
  - Improved long-horizon forecasting (7-day, 30-day)  
  - Increased latent stability  
  - More structured latent geometry  


## Methodology

### 1. Data Processing
- Reservoir storage time series (Sirikit, Nam Oun)
- Chronological train/test split
- Standardization using training data only
- Sliding window formulation (lookback = 180)

### 2. Forecasting Model
- BiLSTM with:
  - 2 layers  
  - Hidden size = 128 (bidirectional → 256 latent dim)  
- Outputs multi-horizon predictions (1-day, 7-day, 30-day)

### 3. Latent Extraction
- Extract full hidden sequence:
  latent_seq ∈ R^{N × T × 256}
- Use final hidden state or sequence for analysis

### 4. Zigzag Persistent Homology
- Apply on evolving latent windows:
  F_i → F_i ∪ F_{i+1} ← F_{i+1}
- Use Vietoris–Rips filtration (Dionysus)
- PCA (3D) for computational efficiency

### 5. Topological Features
From H1 persistence diagrams:
- Number of loops  
- Maximum lifetime  
- Mean lifetime  
- Persistence entropy  

### 6. Topology-Augmented Forecasting
- Concatenate topological features with latent representation
- Train augmented prediction model

## Results Summary

| Horizon | Baseline RMSE | Topo-Aug RMSE | Observation |
|--------|--------------|--------------|------------|
| 1-day  | ~0.0025      | ~0.0028      | No improvement (task too easy) |
| 7-day  | ~0.0402      | ~0.0333      | Improved performance |
| 30-day | ~0.2951      | ~0.2631      | Significant improvement |

Key findings:
- Topology helps more as forecasting difficulty increases  
- Improves long-term prediction stability  
- Reduces latent variance and noise  

## Installation

```bash
conda create -n tda python=3.12
conda activate tda

pip install torch numpy pandas scikit-learn matplotlib
pip install dionysus ripser persim


Citation
@misc{topoforecast2026,
  title={Topology-Augmented Forecasting via Zigzag Persistent Homology},
  author={Madumita Karthikeyan},
  year={2026}
}
