import sqlite3
import pandas as pd

square = lambda n : n*n

conn = sqlite3.connect("Northwind.db")
conn.create_function("square",1,square)

cursor = conn.cursor()
cursor.execute('''
    SELECT * FROM Products
    ''')

resultado = cursor.fetchall()
resultado_df = pd.DataFrame(resultado)

conn.commit()

cursor.close()
conn.close()

print(resultado_df)