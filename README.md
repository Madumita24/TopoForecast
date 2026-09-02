# TopoForecast

**Topology-Augmented Latent Dynamics for Long-Horizon Time Series
Forecasting**

Repository for the reproducibility materials associated with the
manuscript submitted to the *International Journal of Forecasting*.

## Overview

This repository contains code, configurations, processed data, model
outputs, and analysis utilities for experiments on topology-augmented
neural time-series forecasting.

The proposed framework uses a two-stage design:

1.  **Stage A — latent topology extraction**
    - Train a BiLSTM forecasting model.
    - Extract the complete latent-state trajectories.
    - Project latent vectors to three dimensions using PCA for
      computational tractability.
    - Construct overlapping temporal frames.
    - Compute zigzag persistent homology across adjacent frames.
    - Convert the resulting persistence information into
      fixed-dimensional topological descriptors.
2.  **Stage B — topology-augmented forecasting**
    - Initialize and train a second BiLSTM independently from Stage A.
    - Concatenate its final hidden state with the precomputed
      topological descriptors.
    - Use the combined representation to produce the forecast.

The topology descriptors supplied to Stage B are fixed auxiliary inputs
computed from the separately trained Stage A encoder. The topology
computation itself is not differentiated through.

## Main Experiments

The repository is organized around the experiments reported in the
manuscript:

- controlled Lorenz-system validation;
- Sirikit reservoir forecasting;
- univariate forecasting using reservoir storage only;
- bivariate forecasting using reservoir storage and upstream soil
  moisture;
- forecast horizons of 1, 7, and 30 days;
- multi-seed robustness experiments using seeds 7, 42, and 123;
- latent-space geometry and stability analysis;
- permutation-based topology diagnostics; and
- comparisons with classical, machine-learning, deep-learning, and
  Transformer baselines.

------------------------------------------------------------------------

## Reported Results

### Univariate 30-Day Multi-Seed Experiment

| Seed |     BiLSTM RMSE | BiLSTM + Topology RMSE | Gain (%) |
|-----:|----------------:|-----------------------:|---------:|
|    7 |        0.301654 |               0.282953 |    +6.20 |
|   42 |        0.306961 |               0.307895 |    -0.30 |
|  123 |        0.296515 |               0.303057 |    -2.21 |
| Mean | 0.3017 ± 0.0052 |        0.2980 ± 0.0132 |    +1.23 |

The univariate improvement is therefore small on average and varies
across random seeds.

### Bivariate 30-Day Multi-Seed Experiment

| Seed | BiLSTM RMSE | BiLSTM + Topology RMSE | Gain (%) |
|-----:|------------:|-----------------------:|---------:|
|    7 |    0.311917 |               0.283262 |     9.19 |
|   42 |    0.285707 |               0.258785 |     9.42 |
|  123 |    0.331212 |               0.304016 |     8.21 |
| Mean |    0.309612 |               0.282021 |     8.94 |

Topology augmentation improves the bivariate 30-day result for all three
reported seeds.

### 30-Day Univariate Model Comparison

| Model                   |   RMSE (km³) |    MAE (km³) |           R² |
|-------------------------|-------------:|-------------:|-------------:|
| SARIMA                  |     0.553394 |     0.287727 |     0.790607 |
| Random Forest           |     0.468828 |     0.329655 |     0.849713 |
| XGBoost                 |     0.409329 |     0.273896 |     0.885439 |
| GRU                     |     0.388845 |     0.254612 |     0.896617 |
| TCN                     |     0.388581 |     0.227410 |     0.896758 |
| LSTM                    |     0.380491 |     0.235995 |     0.901012 |
| BiLSTM                  |     0.351206 |     0.228914 |     0.915663 |
| PatchTST                |     0.449941 |     0.320224 |     0.861578 |
| **BiLSTM + Zigzag TDA** | **0.313102** | **0.192160** | **0.932971** |

> **Important reproducibility note:** the single-run model-comparison
> experiment, the single-run horizon analysis, and the multi-seed
> robustness experiment were run as separate experimental batches. Their
> numerical values should therefore be reproduced and verified
> separately rather than pooled.

### Horizon Analysis

| Horizon | Baseline RMSE | Topology RMSE | RMSE Gain (%) |
|---------|--------------:|--------------:|--------------:|
| 1 day   |       0.00250 |       0.00279 |         -11.6 |
| 7 days  |       0.04018 |       0.03330 |          17.1 |
| 30 days |       0.29514 |       0.26312 |          10.9 |

These values correspond to the separate single-run horizon-analysis
batch reported in the manuscript.

------------------------------------------------------------------------

## Dataset

### Sirikit Reservoir

The primary reservoir experiments use the Sirikit reservoir subset of
the MSEA-Res v2 dataset.

- Period: **1987-12-12 to 2023-12-31**
- Number of daily observations: **13,169**
- Training period: observations before **2016-01-01**
- Test period: observations from **2016-01-01** onward
- Lookback window: **180 days**
- Forecast horizons: **1, 7, and 30 days**

Two input settings are evaluated:

- **Univariate:** reservoir storage only
- **Bivariate:** reservoir storage + upstream soil moisture

All scaling and normalization statistics are estimated from the training
period only.

### Data Availability

The reservoir data originate from MSEA-Res v2. This repository should
include either the processed Sirikit extract used by the experiments or
exact preparation instructions, subject to the redistribution terms of
the source dataset.

------------------------------------------------------------------------

## Core Model Configuration

### BiLSTM

- hidden dimension: 128 per direction;
- number of recurrent layers: 2;
- bidirectional: yes;
- resulting latent dimension: 256;
- dropout: 0.3;
- optimizer: AdamW;
- learning rate: `1e-3`;
- validation fraction: 15% of the training period;
- early stopping patience: 20 epochs; and
- lookback window: 180 days.

### Zigzag Topology

The reservoir topology pipeline uses:

- temporal frame size: 200;
- frame stride: 50;
- Vietoris–Rips filtration;
- maximum Rips distance: 2.0;
- homology dimension: H1;
- PCA projection to 3 dimensions prior to filtration; and
- zigzag persistent homology computed using **Dionysus**.

The raw topological descriptors are:

- H1 feature count;
- maximum persistence lifetime;
- mean persistence lifetime; and
- persistence entropy.

Descriptors with constant or near-zero variance are removed using
training-period information before they are supplied to Stage B.

------------------------------------------------------------------------

## Installation

Two environment specifications are provided:

``` bash
pip install -r requirements.txt
```

or:

``` bash
conda env create -f environment.yml
conda activate topoforecast
```

The exact software versions used for the final reproducibility release
should be recorded once the repository environment has been verified.

------------------------------------------------------------------------

## Reproducibility Principles

Each experiment directory should contain or point to:

- the exact configuration used for the run;
- the random seed;
- the chronological train/validation/test definition;
- preprocessing parameters;
- model checkpoint(s);
- predictions in original physical units;
- RMSE, MAE, and R²;
- latent-state outputs where required;
- precomputed topology features where required; and
- scripts that verify the reported values.

Small numerical differences may occur across hardware and software
environments despite fixed random seeds, particularly for GPU training.
The repository should record the tested environment used for the final
reproduced results.

------------------------------------------------------------------------

## License

A project license should be selected before the public release of the
repository. Dataset licensing and redistribution conditions remain
governed by the original data provider.

------------------------------------------------------------------------

## Acknowledgments

This work uses PyTorch, scikit-learn, SciPy, statsmodels, XGBoost,
Matplotlib, and Dionysus, together with the MSEA-Res v2 reservoir
dataset.
