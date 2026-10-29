import polars as pl
import json
import sys
import logging
from pydea import DEA

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting DEA analysis")

    try:
        # Read JSON from stdin
        logger.debug("Reading JSON from stdin")
        json_data = sys.stdin.read()
        logger.debug(f"Received JSON data (first 100 chars): {json_data[:100]}...")

        # Parse JSON
        logger.debug("Parsing JSON data")
        data = json.loads(json_data)
        logger.debug(f"Parsed data structure: {type(data)}")
        logger.debug(f"Number of records: {len(data)}")
        logger.debug(f"Sample record: {data[0] if data else 'No data'}")

        # Convert to Polars DataFrame
        logger.debug("Converting to Polars DataFrame")
        df = pl.DataFrame(data)
        logger.debug(f"DataFrame shape: {df.shape}")
        logger.debug(f"DataFrame columns: {df.columns}")
        logger.debug(f"DataFrame dtypes: {df.dtypes}")
        logger.debug(f"First few rows:\n{df.head()}")

        # Prepare data for DEA
        logger.debug("Preparing data for DEA")
        input_columns = ['freedom_expression_i', 'freedom_expression_ii', 'freedom_expression_iii']
        output_columns = ['media_freedom_rsf_index', 'media_freedom_ii']
        
        inputs = df.select(input_columns).to_numpy()
        outputs = df.select(output_columns).to_numpy()
        
        logger.debug(f"Input shape: {inputs.shape}")
        logger.debug(f"Output shape: {outputs.shape}")
        logger.debug(f"Sample input row: {inputs[0]}")
        logger.debug(f"Sample output row: {outputs[0]}")

        # Perform DEA
        logger.info("Performing DEA")
        model = DEA(inputs, outputs)
        efficiency_scores = model.efficiency()
        logger.debug(f"Efficiency scores: {efficiency_scores}")
        logger.debug(f"Min efficiency: {min(efficiency_scores)}, Max efficiency: {max(efficiency_scores)}")

        # Add efficiency scores to the dataframe
        logger.debug("Adding efficiency scores to DataFrame")
        df = df.with_columns(pl.Series('efficiency_score', efficiency_scores))
        logger.debug(f"Updated DataFrame columns: {df.columns}")
        logger.debug(f"Sample rows with efficiency scores:\n{df.select(['country', 'efficiency_score']).head()}")

        # Sort by efficiency score
        logger.debug("Sorting DataFrame by efficiency score")
        df_sorted = df.sort('efficiency_score', descending=True)
        logger.debug(f"Top 5 countries by efficiency:\n{df_sorted.select(['country', 'efficiency_score']).head(5)}")

        # Prepare results
        logger.info("Preparing results")
        results = df_sorted.select(['country', 'efficiency_score']).write_json()
        logger.debug(f"Results JSON (first 100 chars): {results[:100]}...")

        # Identify the efficient DMUs (countries on the envelope)
        logger.debug("Identifying efficient countries")
        efficient_countries = df_sorted.filter(pl.col('efficiency_score') == 1)['country'].to_list()
        logger.debug(f"Efficient countries: {efficient_countries}")

        # Print results
        print(results)
        print(json.dumps(efficient_countries))

        logger.info("DEA analysis completed successfully")
    except Exception as e:
        logger.error(f"An error occurred during DEA analysis: {str(e)}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()